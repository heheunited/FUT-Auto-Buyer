import {
  idAutoBuyerFoundLog,
  idProgressAutobuyer
} from "../elementIds.constants";
import {autoRestartAutoBuyer, startAutoBuyer, stopAutoBuyer} from "../handlers/autobuyerProcessor";
import { updateStats } from "../handlers/statsProcessor";
import {
  getValue,
  increAndGetStoreValue,
  setValue
} from "../services/repository";
import {
  convertRangeToSeconds, convertSecondsToTime,
  getRandNum,
  getRandNumberInRange, getRangeValue, setWaitTimeObj
} from "./commonUtil";
import { writeToLog } from "./logUtil";
import {sendErrorNotificationToUser, sendNotificationToUser} from "./notificationUtil";
import { loadFilter } from "./userExternalUtil";
import {WAIT_UNTIL_WAIT_STATUS, WAIT_UNTIL_WORK_STATUS} from "./constants";

let stopAfter, pauseCycle;

export const stopBotIfRequired = (buyerSetting) => {
  const purchasedCardCount = getValue("purchasedCardCount");
  const cardsToBuy = buyerSetting["idAbCardCount"];

  const botStartTime = getValue("botStartTime").getTime();
  let time = stopAfter || convertRangeToSeconds(buyerSetting["idAbStopAfter"]);
  if (!stopAfter) {
    stopAfter = time;
  }
  let sendDetailedNotification = buyerSetting["idDetailedNotification"];
  let currentTime = new Date().getTime();
  let timeElapsed = (currentTime - botStartTime) / 1000 >= time;
  const isSelling = false;
  // buyerSetting["idSellCheckBuyPrice"] || buyerSetting["idSellFutBinPrice"];
  const isTransferListFull =
      isSelling &&
      repositories.Item &&
      repositories.Item.transfer.length >=
      repositories.Item.pileSizes._collection[5];

  const message = timeElapsed
      ? "Time elapsed"
      : isTransferListFull
          ? "Transfer list is full"
          : "Max purchases count reached";

  if (timeElapsed || getValue('waitStatusRequestCounter') >= buyerSetting['idAbWaitUntilWatchlistWillBeEmptyRequestLimit']){
    let waitUntilWatchlistWillBeEmptyStatus = getValue('waitUntilWatchlistWillBeEmpty');

    if (buyerSetting['idAbWaitUntilWatchlistWillBeEmpty'] &&
        (waitUntilWatchlistWillBeEmptyStatus === WAIT_UNTIL_WORK_STATUS ||
            waitUntilWatchlistWillBeEmptyStatus === WAIT_UNTIL_WAIT_STATUS)
    ) {

      if (waitUntilWatchlistWillBeEmptyStatus !== WAIT_UNTIL_WAIT_STATUS) {
        setWaitTimeObj(...getRangeValue(buyerSetting['idAbWatchlistPlayersLimitWaitTime']))
        setValue('waitUntilWatchlistWillBeEmpty', WAIT_UNTIL_WAIT_STATUS);
        writeToLog("PAUSE/STOP TRIGGERED. WAIT UNTIL WATCHLIST WILL BE EMPTY.", idProgressAutobuyer, "\n");
      }

      return;
    }

    if (buyerSetting["idAbRestartAfter"]) {
      const autoRestart = convertRangeToSeconds(
          buyerSetting["idAbRestartAfter"]
      );

      let logMessage = `Autobuyer stopped (Time elapsed) | Automatic restart in ${convertSecondsToTime(autoRestart)}.`;

      sendNotificationToUser(logMessage);
      sendErrorNotificationToUser(logMessage);
    }
    stopAfter = null;

    setValue('waitStatusRequestCounter', 0);
    setValue('waitUntilWatchlistWillBeEmpty', WAIT_UNTIL_WORK_STATUS);
    stopAutoBuyer(false);
    autoRestartAutoBuyer();
  } else {
    if (isTransferListFull || (cardsToBuy && purchasedCardCount >= cardsToBuy)) {

      if (sendDetailedNotification) {
        sendNotificationToUser(`Autobuyer stopped | ${message}`);
      }

      sendErrorNotificationToUser(`Autobuyer stopped | ${message}`);

      writeToLog(`Autobuyer stopped | ${message}`, idProgressAutobuyer);
      stopAfter = null;
      stopAutoBuyer();
    }
  }
};

export const pauseBotIfRequired = async function (buyerSetting) {
  const isBuyerActive = getValue("autoBuyerActive");

  if (!isBuyerActive) {
    return;
  }

  const pauseFor = convertRangeToSeconds(buyerSetting["idAbPauseFor"]) * 1000;
  const cycleAmount = pauseCycle || getRandNumberInRange(buyerSetting["idAbCycleAmount"]);

  if (!pauseCycle) {
    pauseCycle = cycleAmount;
  }

  const { searchCount, previousPause } = getValue("sessionStats");

  // if (getValue("softbanDetected") === true && buyerSetting["idBypassSoftBan"])
  // {
  //   setValue("softbanDetected", false)
  //   showLoader()
  //   stopAutoBuyer(true);
  //   const isBypassed = await bypassSoftban()
  //   hideLoader()
  //   if (isBypassed)
  //   {
  //     sendUINotification("Softban successfully bypassed");
  //     startAutoBuyer.call(this, true);
  //   }
  //   else
  //     sendUINotification("Softban cant be bypassed");
  // }

  if ((searchCount && !((searchCount - previousPause) % cycleAmount)) || getValue('waitStatusRequestCounter') >= buyerSetting['idAbWaitUntilWatchlistWillBeEmptyRequestLimit']) {
    let waitUntilWatchlistWillBeEmptyStatus = getValue('waitUntilWatchlistWillBeEmpty');

    if (buyerSetting['idAbWaitUntilWatchlistWillBeEmpty'] &&
        (waitUntilWatchlistWillBeEmptyStatus === WAIT_UNTIL_WORK_STATUS ||
            waitUntilWatchlistWillBeEmptyStatus === WAIT_UNTIL_WAIT_STATUS)
    ) {

      if (waitUntilWatchlistWillBeEmptyStatus !== WAIT_UNTIL_WAIT_STATUS) {
        setWaitTimeObj(...getRangeValue(buyerSetting['idAbWatchlistPlayersLimitWaitTime']))
        setValue('waitUntilWatchlistWillBeEmpty', WAIT_UNTIL_WAIT_STATUS);
        writeToLog("PAUSE/STOP TRIGGERED. WAIT UNTIL WATCHLIST WILL BE EMPTY.", idProgressAutobuyer, "\n");
      }

      return;
    }

    setValue('waitStatusRequestCounter', 0);
    setValue('waitUntilWatchlistWillBeEmpty', WAIT_UNTIL_WORK_STATUS);
    updateStats("previousPause", searchCount);
    stopAutoBuyer(true);
    return setTimeout(() => {
      pauseCycle = getRandNumberInRange(buyerSetting["idAbCycleAmount"]);
      startAutoBuyer.call(this, true);
    }, pauseFor);
  }
};

export const switchFilterIfRequired = async function () {
  const availableFilters = getValue("selectedFilters");
  const fiterSearchCount = getValue("fiterSearchCount");
  const currentFilterCount = getValue("currentFilterCount");
  if (
      !availableFilters ||
      !availableFilters.length ||
      fiterSearchCount > currentFilterCount
  ) {
    increAndGetStoreValue("currentFilterCount");
    return false;
  }
  setValue("currentFilterCount", 1);
  setValue("currentPage", 1);
  const currentFilterIndex = getValue("currentFilterIndex") || 0;
  let filterIndex = getValue("runSequentially")
      ? currentFilterIndex % availableFilters.length
      : getRandNum(0, availableFilters.length - 1);

  setValue("currentFilterIndex", filterIndex + 1);
  let filterName = availableFilters[filterIndex];
  await loadFilter.call(this, filterName);
  writeToLog(
      `---------------------------  Running for filter ${filterName}  ---------------------------------------------`,
      idAutoBuyerFoundLog
  );
};

const checkWaitUntilWatchlistWillBeEmptyStatus = () => {

}
