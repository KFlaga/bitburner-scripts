export function formatMoney(x) {
    if (x > 2 * 1e13) {
        return (x / 1e12).toString() + "t";
    }
    if (x > 2 * 1e10) {
        return (x / 1e9).toString() + "b";
    }
    if (x > 2 * 1e7) {
        return (x / 1e6).toString() + "m";
    }
    if (x > 2 * 1e3) {
        return (x / 1e3).toString() + "k";
    }
    return x.toString();
}

export function crack(ns, remote) {
    if (ns.fileExists("BruteSSH.exe"))
        ns.brutessh(remote);
    if (ns.fileExists("FTPCrack.exe"))
        ns.ftpcrack(remote);
    if (ns.fileExists("relaySMTP.exe"))
        ns.relaysmtp(remote);
    if (ns.fileExists("HTTPWorm.exe"))
        ns.httpworm(remote);
    if (ns.fileExists("SQLInject.exe"))
        ns.sqlinject(remote);
    try {
        ns.nuke(remote);
    }
    catch (x) {
    }
}

export function isMyServer(name) {
    return name == "home" || name == "darkweb" || (name.length > 1 && name[0] == 's' && !isNaN(name[1]));
}

export function isIn(list, item) {
    return list.findIndex(function (x) { return x == item; }) >= 0;
}

export function walkNodes(ns, startNode, func, includeHost = false) {
    let nodeQueue = [];
    nodeQueue.push(startNode);
    let visitedNodes = [];

    while (nodeQueue.length > 0) {
        let node = nodeQueue.shift();
        if (includeHost || node != startNode)
            func(node);

        const nodes = ns.scan(node);
        for (const target of nodes) {
            if (!isIn(visitedNodes, target)) {
                visitedNodes.push(target);
                nodeQueue.push(target);
            }
        }
    }
}

/** @param {NS} ns */
export function getDistributableServers(ns) {
	let servers = [];
	walkNodes(ns, "home", function (node) {
		if (ns.getServerMaxRam(node) > 0 && ns.hasRootAccess(node)) {
			servers.push(node);
		}
	}, true);
	return servers;
}

/** @param {NS} ns */
export function getHackableServers(ns) {
	let servers = [];
	walkNodes(ns, "home", function (node) {
		if (ns.getServerRequiredHackingLevel(node) <= ns.getHackingLevel() && ns.hasRootAccess(node) && ns.getServerMaxMoney(node) > 0) {
			servers.push(node);
		}
	}, true);
	return servers;
}

/** @param {NS} ns */
export function getServerStats(ns, node, scalingFactor, minThreads, maxThreads, minWorkers, maxWorkers) {
    let specialScaling = {};

    const input = ns.read("extra-scaling.txt");
    if(input.length > 0) {
        const lines = input.split("\n");
        for(const l of lines) {
            specialScaling[l.split(",")[0]] = Number.parseFloat(l.split(",")[1]);
        }
    }

	const minWorkerThreads = 8;
	const preferableWorkerCount = Math.max(minWorkers, Math.min(Math.floor(ns.getServerRequiredHackingLevel(node)/2), maxWorkers));

	let threads = Math.ceil(
		(ns.getServerRequiredHackingLevel(node) * 20 + (Math.pow(ns.getServerMaxMoney(node), 0.66) / 1000))
		* Math.pow(ns.getServerGrowth(node), 0.66)
		* (1.0 / Math.pow(ns.getServerMinSecurityLevel(node), 0.33))
		* scalingFactor
	);

    if(node in specialScaling) {
        threads = threads * specialScaling[node];
    }

    let unboundThreads = threads;
	threads = Math.round(Math.max(minThreads, Math.min(threads, maxThreads)))
	let threadsPerWorker = Math.round(Math.max(minWorkerThreads, Math.round(threads / preferableWorkerCount)));
	let workerCount = Math.round(threads / threadsPerWorker);
	let cycleTime = Math.ceil(Math.max(100, Math.min(3000, ns.getServerRequiredHackingLevel(node) * 20)));

	return {
		"name": node,
		"threads": (threadsPerWorker * workerCount),
		"workerCount": workerCount,
		"threadsPerWorker": threadsPerWorker,
		"cycleTime": cycleTime,
		"unboundThreads": unboundThreads
	};
}

/** @param {NS} ns */
export function isAliveServer(ns, server) {
	let found = false;
	walkNodes(ns, "home", function (node) {
		if (node == server) {
			found = true;
		}
	}, true);
	return found;
}

var timerStates = {};

export function oncePerMs(ms, key, func) {
    if(!(key in timerStates)) {
        timerStates[key] = 0;
    }

    let nowMs = performance.now();
    let diff = nowMs - timerStates[key];
    if(diff > ms) {
        timerStates[key] = nowMs;
        func();
    }
}