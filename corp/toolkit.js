export function canEval(expr) {
    try {
        let n = expr();
        return true;
    } catch (x) {
        return false;
    }
}

export function maxIndex(arr, criteria) {
    if(arr.length == 0) {
        return -1;
    }

    let maxCrit = criteria(arr[0]);
    let maxIndex = 0;
    for (let i = 1; i < arr.length; ++i) {
        let c = criteria(arr[i]);
        if (c > maxCrit) {
            maxIndex = i;
            maxCrit = c;
        }
    }
    return maxIndex;
}

export function forEach2(arr1, arr2, func) {
    for(let a of arr1) {
        for(let b of arr2) {
            func(a, b);
        }
    }
}

export function isIn(list, item) {
    return list.findIndex(function (x) { return x == item; }) >= 0;
}
