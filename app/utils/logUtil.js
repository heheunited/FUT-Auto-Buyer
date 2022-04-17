import {
  idAutoBuyerFoundLog,
  idProgressAutobuyer,
} from "../elementIds.constants";
import { getBuyerSettings, getValue } from "../services/repository";
import { initializeLog } from "../views/layouts/LogView";
import {sendErrorNotificationToUser, sendNotificationToUser} from "./notificationUtil";

export const writeToDebugLog = (
  ratingTxt,
  playerName,
  bidTxt,
  buyTxt,
  futbinPriceTxt,
  expireTime,
  actionTxt
) => {
  writeToLog(
    "| " +
      ratingTxt +
      " | " +
      playerName +
      " | " +
      bidTxt +
      " | " +
      buyTxt +
      " | " +
      futbinPriceTxt +
      " | " +
      expireTime +
      " | " +
      actionTxt,
    idAutoBuyerFoundLog
  );
};

export const writeToAbLog = (
    sym,
    ItemName,
    priceTxt,
    futBinPrice,
    operation,
    result,
    comments,
    expireTime = ''
) => {
  let message =
      sym +
      " | " +
      ItemName +
      " | " +
      priceTxt +
      " | " +
      futBinPrice +
      " | " +
      operation +
      " | " +
      result +
      " | " +
      comments +
      " | " +
      expireTime;
  writeToLog(message, idProgressAutobuyer);
  return message;
};

export const showCaptchaLogs = function (captchaCloseTab) {
  sendNotificationToUser("Captcha, please solve the problem so that the bot can work again.");

  sendErrorNotificationToUser("[!!!] Autostopping bot since Captcha got triggered")

  if (captchaCloseTab) {
    window.location.href = "about:blank";
    return;
  }
  writeToLog(
    "[!!!] Autostopping bot since Captcha got triggered",
    idProgressAutobuyer
  );
};

export const writeToLog = function (message, log, lineBreak = '') {
  let $log = $("#" + log);

  message = lineBreak + "[" + new Date().toLocaleTimeString() + "] " + message + "\n";
  $log.val($log.val() + message);
  if ($log[0]) $log.scrollTop($log[0].scrollHeight);

  return message;
};

export const clearLogs = () => {
  $("#" + idAutoBuyerFoundLog).val("");
  $("#" + idProgressAutobuyer).val("");
  initializeLog();
};

setInterval(() => {
  const settings = getBuyerSettings();
  let autoClearLog = settings && settings["idAutoClearLog"];
  autoClearLog && clearLogs();
}, 120000);
