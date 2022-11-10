import * as utils from "utils.js";

const workerRam = 2.0;
const homeReservedRam = 1032;
const weakenRate = 0.05;
const workerScript = "worker_v2.js";
const moneyHighScale = 0.90;
const moneyLowScale = 0.60;
var createdWorkers = 0;
const maxCreatedWorkersPerSleep = 200;

// { "server": [ { "server": "", "threads": "", "id" } ] }
var workerPool = {};
// { "server": { "workerId": { "threads": "", "command": "" } } }
var commandPool = {};

var targetStats = {};

/** @param {NS} ns */
function getMaxThreads(ns, scriptRam, target) {
	const maxRam = ns.getServerMaxRam(target);
	const usedRam = ns.getServerUsedRam(target);
	let freeRam = maxRam - usedRam;
	if (target == "home") {
		freeRam -= homeReservedRam;
	}
	const maxThreads = Math.max(0, Math.floor(freeRam / scriptRam));
	return maxThreads;
}

function getCommandPath(workerId, server) {
	return "command-" + server + ".txt";
}

function ensureServersInPool(allServers) {
	for (const server of allServers) {
		if (!(server in commandPool)) {
			commandPool[server] = {};
		}
	}
}

/** @param {NS} ns */
async function createWorkers(ns, target, threadsPerWorker, totalThreads) {
	const allServers = utils.getDistributableServers(ns);
	ensureServersInPool(allServers);

	let workers = [];
	let remainingThreads = totalThreads;

	for (const server of allServers) {
		ns.scp([workerScript], server, "home");

		let nextWorkerThreads = Math.min(getMaxThreads(ns, workerRam, server), threadsPerWorker, remainingThreads);
		while (nextWorkerThreads >= (threadsPerWorker / 4)) {
			const workerId = Number(ns.read("worker-id.txt"));
			const commandPath = getCommandPath(workerId, server);
			let workerInfo = {
				"server": server,
				"workerId": workerId,
				"target": target,
				"threads": nextWorkerThreads,
				"pid": 0,
				"command": commandPath
			};

			createdWorkers++;
			if(createdWorkers % maxCreatedWorkersPerSleep == (maxCreatedWorkersPerSleep-1)) {
				await ns.sleep(200); // wait a while, so game wont freeze when exec-ing too many workers
			}

			var pid = ns.exec(workerScript, server, nextWorkerThreads, workerId, commandPath, target, nextWorkerThreads);
			if (pid > 0) {
				ns.write("worker-id.txt", workerId + 1, "w");
				workerInfo.pid = pid;
				workers.push(workerInfo);
				commandPool[server][workerId] = { "target": target, "threads": nextWorkerThreads, "command": 'x' };

				remainingThreads = remainingThreads - nextWorkerThreads;
				nextWorkerThreads = Math.min(getMaxThreads(ns, workerRam, server), threadsPerWorker, remainingThreads);
			}
		}

		if (remainingThreads < (threadsPerWorker / 4)) {
			break;
		}
	}
	return workers;
}

/** @param {NS} ns 
 *  @param {any[]} workers
*/
function scrambleDeadWorkers(ns, workers) {
	for (let i = 0; i < workers.length; i = i + 1) {
		const worker = workers[i];
		if (!ns.isRunning(worker.pid)) {
			workers.splice(i, 1);
			i = i - 1;
		}
	}
	return workers;
}

/** @param {NS} ns 
 *  @param {any[]} workers
*/
function killWorkers(ns, workers, threadsToFree) {
	for(let worker of workers.filter((w) => w.threads < threadsToFree)) {
		ns.kill(worker.pid);
		threadsToFree -= worker.threads;
	}
}

/** @param {NS} ns 
 *  @param {any[]} workers
*/
function getAllThreads(ns, workers) {
	let threads = 0;
	for (const worker of workers.filter((w) => ns.isRunning(w.pid))) {
		threads = threads + worker.threads;
	}
	return threads;
}

/** @param {NS} ns */
function commandWorker(ns, worker, action, threads, target) {
	if (!ns.isRunning(worker.pid)) {
		return;
	}

	let serverCommands = commandPool[worker.server];
	serverCommands[worker.workerId] = {
		"target": target,
		"command": action,
		"threads": threads
	};
}

/** @param {NS} ns */
function getWorkerCommand(ns, worker) {
	if (!ns.isRunning(worker.pid)) {
		return 'x';
	}

	let serverCommands = commandPool[worker.server];
	if(!(worker.workerId in serverCommands)) {
		return 'x';
	}

	let workerCommand = serverCommands[worker.workerId];
	if (workerCommand.command.length == 0) {
		return 'x';
	}
	return workerCommand.command;
}

/** @param {NS} ns */
function getWorkerUsedThreads(ns, worker) {
	if (!ns.isRunning(worker.pid)) {
		return 0;
	}

	let serverCommands = commandPool[worker.server];
	let workerCommand = serverCommands[worker.workerId];
	return workerCommand.threads;
}

/** @param {NS} ns */
function isWorkerFree(ns, worker) {
	const c = getWorkerCommand(ns, worker);
	return c.length == 0 || !(c[0] == 'h' || c[0] == 'g' || c[0] == 'w');
}

/** @param {NS} ns */
function distributeCommand(ns, workers, action, threads, target) {
	let remainingThreads = threads;
	for (let worker of workers) {
		if (isWorkerFree(ns, worker)) {
			const t = Math.min(remainingThreads, worker.threads);
			commandWorker(ns, worker, action, t, target);
			remainingThreads = remainingThreads - t;
		}

		if (remainingThreads <= 0) {
			break;
		}
	}
	return (threads - remainingThreads);
}

/** @param {NS} ns */
function getFreeThreads(ns, workers) {
	let threads = 0;
	for (let worker of workers) {
		if (isWorkerFree(ns, worker)) {
			threads = threads + worker.threads;
		}
	}
	return threads;
}

/** @param {NS} ns */
function getHackingThreads(ns, workers) {
	let threads = 0;
	for (let worker of workers) {
		let command = getWorkerCommand(ns, worker);
		if (command[0] == 'h') {
			threads = threads + getWorkerUsedThreads(ns, worker);
		}
	}
	return threads;
}

/** @param {NS} ns */
function expectationFilter(ns, expected, actual) {
	return expected * 0.995 + actual * 0.005;
}

/** @param {NS} ns */
function addNewTarget(ns, targetStats, target, scalingFactor, minServerThreads, maxServerThreads, minWorkers, maxWorkers) {
	let s = utils.getServerStats(ns, target, scalingFactor, minServerThreads, maxServerThreads, minWorkers, maxWorkers);
	targetStats[target] = {
		"expectedSecurity": ns.getServerSecurityLevel(target),
		"expectedMoney": ns.getServerMoneyAvailable(target),
		"moneyHigh": ns.getServerMaxMoney(target) * moneyHighScale,
		"moneyLow": ns.getServerMaxMoney(target) * moneyLowScale,
		"securityLow": ns.getServerMinSecurityLevel(target),
		"securityHigh": ns.getServerMinSecurityLevel(target) + 2 + weakenRate * s.threadsPerWorker * 2.0,
		"hackingThreadsQueued": 0,
		"hackingThreadsNeeded": 0,
		"threads": s.threads,
		"threadsPerWorker": s.threadsPerWorker,
		"workerCount": s.workerCount,
		"cycleTime": s.cycleTime,
		"lastCycle": Date.now()
	};
}

async function manageWorkers(ns, target, tstats) {
	let workers = [];
	if (target in workerPool) {
		workers = workerPool[target];
	} else {
		workerPool[target] = [];
	}

	workers = scrambleDeadWorkers(ns, workers);
	let workThreads = getAllThreads(ns, workers);
	let missingThreads = tstats.threads - workThreads;
	utils.oncePerMs(60000, "worker-stats-"+target, function() {
		ns.print(target + ": tot W = " + workers.length + ", tot T = " + workThreads + ", miss = " + missingThreads);
	});
	if (missingThreads >= tstats.threadsPerWorker) {
		let newWorkers = await createWorkers(ns, target, tstats.threadsPerWorker, missingThreads);
		workers = workers.concat(newWorkers);
		workerPool[target] = workers;
	} else if (missingThreads <= -5*tstats.threadsPerWorker) {
		killWorkers(ns, workers, -missingThreads);
		workers = scrambleDeadWorkers(ns, workers);
	}
	return workers;
}

function updateExpectations(ns, target, tstats) {
	if (tstats.expectedSecurity < ns.getServerMinSecurityLevel(target)) {
		tstats.expectedSecurity = ns.getServerSecurityLevel(target);
	}
	tstats.expectedSecurity = expectationFilter(ns, tstats.expectedSecurity, ns.getServerSecurityLevel(target));
	if (tstats.expectedMoney < 0) {
		tstats.expectedMoney = ns.getServerMoneyAvailable(target);
	}
	if (tstats.expectedMoney > ns.getServerMaxMoney(target)) {
		tstats.expectedMoney = ns.getServerMaxMoney(target);
	}
	tstats.expectedMoney = expectationFilter(ns, tstats.expectedMoney, ns.getServerMoneyAvailable(target));
	return tstats;
}

function distributeWeaken(ns, target, workers, tstats, freeThreads, maxWeakenThreadsPerBatch) {
	let remainingSecurity = tstats.expectedSecurity - tstats.securityLow;
	let weakenThreads = Math.min(freeThreads, Math.floor(remainingSecurity / weakenRate));
	weakenThreads = Math.min(weakenThreads, maxWeakenThreadsPerBatch);
	if (weakenThreads >= tstats.threadsPerWorker / 2) {
		weakenThreads = distributeCommand(ns, workers, 'w', weakenThreads, target);
		tstats.expectedSecurity = tstats.expectedSecurity - weakenThreads * 0.05;
		return weakenThreads
	} else {
		return 0;
	}
}

function distributeHack(ns, target, workers, tstats) {
	tstats.hackingThreadsQueued = getHackingThreads(ns, workers);
	if (ns.getServerMoneyAvailable(target) > tstats.moneyHigh) {
		let moneyToHack = ns.getServerMoneyAvailable(target) - tstats.moneyLow;
		let moneyRatio = moneyToHack / tstats.expectedMoney;
		let hackThreads = moneyRatio / ns.hackAnalyze(target); // ht = money / ns.hackAnalyze(target)
		hackThreads = hackThreads * 1.2;
		tstats.hackingThreadsNeeded = Math.floor(hackThreads - tstats.hackingThreadsQueued);
	} else {
		tstats.hackingThreadsNeeded = 0;
	}

	if (tstats.hackingThreadsNeeded > 0) {
		let freeThreads = getFreeThreads(ns, workers);
		let hackThreads2 = Math.min(tstats.hackingThreadsNeeded, freeThreads);
		if (hackThreads2 > 0) {
			hackThreads2 = distributeCommand(ns, workers, 'h', hackThreads2, target);
			tstats.hackingThreadsNeeded = tstats.hackingThreadsNeeded - hackThreads2;
			tstats.expectedSecurity = tstats.expectedSecurity + hackThreads2 * 0.002;
			tstats.expectedMoney = tstats.expectedMoney + tstats.expectedMoney * ns.hackAnalyzeChance(target) * ns.hackAnalyze(target) * hackThreads2;
		}
	}
}

function distributeGrow(ns, target, workers, tstats, maxGrowThreadsPerBatch) {
	let freeThreads = getFreeThreads(ns, workers);
	let growThreads = Math.min(maxGrowThreadsPerBatch, freeThreads);
	if (growThreads > tstats.threadsPerWorker / 4) {
		growThreads = distributeCommand(ns, workers, 'g', growThreads, target);
		tstats.expectedSecurity = tstats.expectedSecurity + 0.04 * growThreads;
		let threadsToDoubleMoney = ns.growthAnalyze(target, 2.0, 1);
		tstats.expectedMoney = tstats.expectedMoney + tstats.expectedMoney * threadsToDoubleMoney / growThreads;
	}
}

/** @param {NS} ns */
function scrambleServers(ns) {
	for (let server in commandPool) {
		if (!utils.isAliveServer(ns, server)) {
			const path = getCommandPath(0, server);
			delete commandPool[server];
			ns.rm(path);
		}
	}
}

/** @param {NS} ns */
function sendCommands(ns) {
	scrambleServers(ns);
	for (const server in commandPool) {
		const commands = commandPool[server];
		const path = getCommandPath(0, server);
		ns.write(path, JSON.stringify(commands), "w");
		try {
			ns.scp(path, server);
		} catch (x) { }
	}
}

/** @param {NS} ns */
function readCommands(ns) {
	scrambleServers(ns);
	for (const server in commandPool) {
		const path = getCommandPath(0, server);
		try {
			ns.scp(path, "home", server);
		} catch (x) { }
		const input = ns.read(path);
		const commands = JSON.parse(input);
		commandPool[server] = commands;
	}
}

/** @param {NS} ns */
function restoreCommands(ns) {
	const commandFiles = ns.ls("home", "command-");
	let restoredCommands = 0;
	for (const commandFile of commandFiles) {
		const input = ns.read(commandFile);
		const server = commandFile.substr("command-".length, commandFile.length - "command-.txt".length);
		commandPool[server] = JSON.parse(input);
		restoredCommands += Object.keys(commandPool[server]).length;
	}
	ns.print("Restored commands: " + restoredCommands + " for " + commandFiles.length + " servers");
}

/** @param {NS} ns */
function restoreWorkers(ns) {
	const allServers = utils.getDistributableServers(ns);
	let restoredCount = 0;
	for (const server of allServers) {
		const processes = ns.ps(server);
		for (const process of processes) {
			if (process.filename != workerScript) {
				continue;
			}

			let target = process.args[2];
			let workerInfo = {
				"server": server,
				"workerId": process.args[0],
				"target": target,
				"threads": process.threads,
				"pid": process.pid,
				"command": process.args[1]
			};
			
			let workers = [];
			if (target in workerPool) {
				workers = workerPool[target];
			}
			workers.push(workerInfo);
			workerPool[target] = workers;
			restoredCount += 1;
		}
	}
	ns.print("Restored workers: " + restoredCount + " for " + Object.keys(workerPool).length + " targets");
}

/** @param {NS} ns */
function restoreState(ns) {
	restoreCommands(ns);
	restoreWorkers(ns);
}

/** @param {NS} ns */
function updateServerStats(ns, hackableServers) {
	let statFactors = JSON.parse(ns.read("stats-factors.txt"));
	let scalingFactor = statFactors.scalingFactor;
	let minServerThreads = statFactors.minServerThreads;
	let maxServerThreads = statFactors.maxServerThreads;
	let minWorkers = statFactors.minWorkers;
	let maxWorkers = statFactors.maxWorkers;

	for (const target of hackableServers) {
		if (!(target in targetStats)) {
			ns.print("Adding new server to hack " + target);
			addNewTarget(ns, targetStats, target, scalingFactor, minServerThreads, maxServerThreads, minWorkers, maxWorkers);
		} else {
			let s = utils.getServerStats(ns, target, scalingFactor, minServerThreads, maxServerThreads, minWorkers, maxWorkers);
			targetStats[target].threads = s.threads;
			targetStats[target].threadsPerWorker = s.threadsPerWorker;
			targetStats[target].workerCount = s.workerCount;
			targetStats[target].cycleTime = s.cycleTime;
		}
	}
}

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("scp");
	ns.disableLog("getServerSecurityLevel");
	ns.disableLog("getServerMoneyAvailable");
	ns.disableLog("getServerMaxMoney");
	ns.disableLog("getServerMinSecurityLevel");
	ns.disableLog("getServerMaxRam");
	ns.disableLog("getServerUsedRam");
	ns.disableLog("sleep");
	ns.disableLog("getHackingLevel");
	ns.disableLog("scan");
	ns.disableLog("getServerRequiredHackingLevel");
	ns.disableLog("getServerGrowth");

	restoreState(ns);

	while (true) {
		createdWorkers = 0;
		const hackableServers = utils.getHackableServers(ns);
		updateServerStats(ns, hackableServers)
		readCommands(ns);

		for (const target of hackableServers) {
			let tstats = targetStats[target];
			const time = Date.now();
			if ((time - tstats.lastCycle) >= tstats.cycleTime) {
				tstats.lastCycle = time;

				const workers = await manageWorkers(ns, target, tstats);
				tstats = updateExpectations(ns, target, tstats);

				const freeThreads = getFreeThreads(ns, workers);
				const maxGrowThreadsPerBatch = tstats.threadsPerWorker * 2;
				const maxWeakenThreadsPerBatch = tstats.threadsPerWorker * 4;

				distributeWeaken(ns, target, workers, tstats, freeThreads, maxWeakenThreadsPerBatch);
				if (tstats.expectedSecurity < tstats.securityHigh) {
					distributeHack(ns, target, workers, tstats);
					distributeGrow(ns, target, workers, tstats, maxGrowThreadsPerBatch);
				}
			}
		}

		sendCommands(ns);

		await ns.sleep(100);
	}
}