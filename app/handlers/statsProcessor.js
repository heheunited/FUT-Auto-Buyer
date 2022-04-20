import {
  idAbActiveTransfers,
  idAbAvailableItems,
  idAbCoins,
  idAbCountDown,
  idAbProfit,
  idAbRequestCount,
  idAbSearchProgress,
  idAbSoldItems,
  idAbStatisticsProgress,
  idAbUnsoldItems,
  id24hTlErrors,
  idLastWonItemsCount,
  idLastLessMaxBidItemsCount,
  idLastGreaterMaxBidItemsCount,
  id24hTlCaptcha, idAbLastProfit,
} from "../elementIds.constants";
import { sendMessageToDiscord } from "../services/discordService";
import { getValue, setValue } from "../services/repository";
import { getTimerProgress } from "../utils/commonUtil";

setValue("sessionStats", {
  soldItems: "-",
  unsoldItems: "-",
  activeTransfers: "-",
  availableItems: "-",
  coins: "-",
  coinsNumber: 0,
  searchCount: 0,
  previousPause: 0,
  profit: 0,
  lastProfit: 0,
  tl24hErrors: 0,
  tl24hCaptcha: 0,
  lastWonItemsCount: 0,
  lastLessMaxBidItemsCount: 0,
  lastGreaterMaxBidItemsCount: 0,
  sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2),
  transactions: [],
});

export const statsProcessor = () => {
  // exportStatsExternal();
  setInterval(() => {
    const nextRefresh = getTimerProgress(getValue("searchInterval"));
    const currentStats = getValue("sessionStats");
    $("#" + idAbSearchProgress).css("width", nextRefresh);
    $("#" + idAbStatisticsProgress).css("width", nextRefresh);

    $("#" + idAbCoins).html(currentStats.coins);
    $("#" + idAbLastProfit).html(currentStats.lastProfit);
    $("#" + idAbRequestCount).html(currentStats.searchCount);
    $("#" + idAbSoldItems).html(currentStats.soldItems);
    $("#" + idAbUnsoldItems).html(currentStats.unsoldItems);
    $("#" + idAbAvailableItems).html(currentStats.availableItems);
    $("#" + idAbActiveTransfers).html(currentStats.activeTransfers);
    $("#" + idAbProfit).html(currentStats.profit);

    $("#" + id24hTlErrors).html(currentStats.tl24hErrors);
    $("#" + id24hTlCaptcha).html(currentStats.tl24hCaptcha);

    $("#" + idLastWonItemsCount).html(currentStats.lastWonItemsCount);
    $("#" + idLastLessMaxBidItemsCount).html(currentStats.lastLessMaxBidItemsCount);
    $("#" + idLastGreaterMaxBidItemsCount).html(currentStats.lastGreaterMaxBidItemsCount);

    updateTimer();

    if (currentStats.unsoldItems) {
      $("#" + idAbUnsoldItems).css("color", "red");
    } else {
      $("#" + idAbUnsoldItems).css("color", "");
    }

    if (currentStats.availableItems) {
      $("#" + idAbAvailableItems).css("color", "orange");
    } else {
      $("#" + idAbAvailableItems).css("color", "");
    }
  }, 1000);
};

const updateTimer = () => {
  const startTime = getValue("botStartTime");
  if (startTime && getValue("autoBuyerActive")) {
    const diffInSeconds = Math.abs(new Date() - startTime) / 1000;
    const hrs = Math.floor((diffInSeconds / 60 / 60) % 24);
    const mins = Math.floor((diffInSeconds / 60) % 60);
    const secs = Math.floor(diffInSeconds % 60);
    const timeString =
      (hrs < 10 ? "0" : "") +
      hrs +
      ":" +
      (mins < 10 ? "0" : "") +
      mins +
      ":" +
      (secs < 10 ? "0" : "") +
      secs;
    $("#" + idAbCountDown).html(timeString);
    updateStats("runningTime", timeString);
  }
};

export const exportStatsExternal = () => {
  const persona = services.User.getUser().getSelectedPersona();
  const club = persona.getCurrentClub();
  setInterval(async () => {
    const currentStats = getValue("sessionStats");
    const autoBuyerState = getValue("autoBuyerState");
    const availableFilters = getValue("filters") || {};
    const currentFilter = getValue("currentFilter");
    const lastErrorMessage = getValue("lastErrorMessage");
    const selectedFilters = getValue("selectedFilters");
    const payload = {
      autoBuyerState,
      persona: persona.name,
      clublogo: club.assetId,
      availableFilters: Object.keys(availableFilters),
      selectedFilters,
      currentFilter,
      lastErrorMessage,
      sessionId: currentStats.sessionId,
      searchCount: currentStats.searchCount,
      coinsNumber: currentStats.coinsNumber,
      profit: currentStats.profit,
      type: "statsUpdate",
    };
    await sendMessageToDiscord(btoa(JSON.stringify(payload)));
  }, 5000);
};

export const updateStats = (key, value) => {
  const currentStats = getValue("sessionStats");
  currentStats[key] = value;
  setValue("sessionStats", currentStats);
};

export const getStatsValue = (key) => {
  const currentStats = getValue("sessionStats");
  return currentStats[key] || 0;
};

export const getTransferListTotalItemsCount = () => {
  const currentStats = getValue("sessionStats");
  const requiredStats = ['soldItems', 'activeTransfers', 'unsoldItems', 'availableItems'];

  let total = 0;
  requiredStats.map((stat) => {
    let value = currentStats[stat];

    if (typeof value === 'number') {
      total += value;
    }
  })

  return total;
}