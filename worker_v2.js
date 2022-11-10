/** @param {NS} ns */
export async function main(ns) {
    var workerId = ns.args[0];
    var commandPath = ns.args[1];
    // var target = ns.args[2];
    // var myThreads = ns.args[3];
    
	ns.disableLog("sleep");

    while(true) {
        var input = ns.read(commandPath);
        if (input.length == 0) {
            await ns.sleep(1000);
            continue;
        }

        try
        {
            // { "workerId": { "threads": "", "command": "", "target": "" } }
            let commandPool = JSON.parse(input);
            let command = commandPool[workerId];
            let action = command.command;
            let threads = Number(command.threads);
            let target = command.target;
            let downStock = ("downStock" in command) && command[downStock];
            let upStock = ("upStock" in command) && command[upStock];

            if (action == 'h') {
                await ns.hack(target, { threads: threads, stock: downStock });
            } else if (action == 'g') {
                await ns.grow(target, { threads: threads, stock: upStock });
            } else if(action == 'w') {
                await ns.weaken(target, { threads: threads });
            } else {
                action = 'x';
                await ns.sleep(200);
            }

            if (action != 'x') {
                var input = ns.read(commandPath);
                let commandPool = JSON.parse(input);
                commandPool[workerId] = { "command": 'x', "threads": threads, "target": target };
                ns.write(commandPath, JSON.stringify(commandPool), "w");
                await ns.sleep(100);
            }
        }
        catch(ex) {
            ns.print("Exception: " + ex.toString());
            await ns.sleep(1000);
        }
    }
}