import {setValue} from "../services/repository";
import {getWaitTimeObj} from "./commonUtil";

export const setRandomInterval = (intervalFunction) => {
    let timeout;
    let isCleared = false;

    const runInterval = () => {
        let timeObj = getWaitTimeObj();
        let start = timeObj.start;
        let end = timeObj.end;

        if (isCleared) {
          return;
        }

        const searchInterval = {
            start: Date.now(),
        };

        const timeoutFunction = () => {
            intervalFunction();
            runInterval();
        };

        const delay = parseFloat((Math.random() * (end - start) + start).toFixed(1)) * 1000;
        searchInterval.end = searchInterval.start + delay;
        setValue("searchInterval", searchInterval);
        timeout = setTimeout(timeoutFunction, delay);
    };

    runInterval();

    return {
        clear() {
            isCleared = true;
            clearTimeout(timeout);
        },
    };
};
