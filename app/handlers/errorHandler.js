import { idProgressAutobuyer } from "../elementIds.constants";
import {
  getBuyerSettings,
  getValue,
  increAndGetStoreValue,
  setValue,
} from "../services/repository";
import { playAudio } from "../utils/commonUtil";
import { showCaptchaLogs, writeToLog } from "../utils/logUtil";
import {sendErrorNotificationToUser, sendNotificationToUser} from "../utils/notificationUtil";
import { stopAutoBuyer } from "./autobuyerProcessor";
import { solveCaptcha } from "./captchaSolver";
import {longPollingCaptchaResolve} from "../utils/captchaUtil";
import {createCaptcha} from "../utils/api/errorsStatistic";

export const searchErrorHandler = (
  response,
  canSolveCaptcha,
  captchaCloseTab
) => {
  let shouldStopBot = false;
  let isCaptchaTriggered = false;
  if (
    response.status === UtasErrorCode.CAPTCHA_REQUIRED ||
    (response.error && response.error.code == UtasErrorCode.CAPTCHA_REQUIRED)
  ) {
    shouldStopBot = true;
    if (canSolveCaptcha) {
      writeToLog(
        "[!!!] Captcha got triggered, trying to solve it",
        idProgressAutobuyer
      );
      solveCaptcha();
    } else {
      isCaptchaTriggered = true;
      showCaptchaLogs(captchaCloseTab);
      setValue("lastErrorMessage", "Captcha Triggerred");
    }
  } else {
    const buyerSetting = getBuyerSettings();
    let sendDetailedNotification = buyerSetting["idDetailedNotification"];
    const searchFailedCount = increAndGetStoreValue("searchFailedCount");
    if (searchFailedCount >= 3) {
      shouldStopBot = true;

      let message = writeToLog(
        `[!!!] Autostopping bot as search failed for ${searchFailedCount} consecutive times, please check if you can access transfer market in Web App ${response.status}`,
        idProgressAutobuyer
      );

      setValue(
        "lastErrorMessage",
        `Search failed ${searchFailedCount} consecutive times`
      );

      if (sendDetailedNotification) {
        sendNotificationToUser(message);
      }

      sendErrorNotificationToUser(message);
    } else {
      writeToLog(
        `[!!!] Search failed - ${response.status}`,
        idProgressAutobuyer
      );
    }
  }
  if (shouldStopBot) {
    playAudio("capatcha");
    stopAutoBuyer();

    if (isCaptchaTriggered) {
      createCaptcha();
      longPollingCaptchaResolve();
    }
  }
};
