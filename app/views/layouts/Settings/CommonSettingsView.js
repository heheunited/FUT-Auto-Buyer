import {
  idAbIgnoreTradeIds,
  idAbPreventTransferListOverflow,
  idAbPreventWatchListOverflow,
  idAbResumeAfterErrorOccured,
  idAbStopErrorCode,
  idAbStopErrorCodeCount,
  idAutoClearExpired,
  idAutoClearLog,
  idCacheFutBinPriceByElapsedTime, idClearExpiredItems, idFutBinPricesCacheTime,
} from "../../../elementIds.constants";
import { generateTextInput } from "../../../utils/uiUtils/generateTextInput";
import { generateToggleInput } from "../../../utils/uiUtils/generateToggleInput";

export const commonSettingsView = function () {
  return `<div style='display : none' class='buyer-settings-wrapper common-settings-view'>
  <hr class="search-price-header header-hr">
  <div class="search-price-header">
    <h1 class="secondary">Common Settings:</h1>
  </div>
  ${generateTextInput(
    "Error Codes to stop bot (csv)",
    "",
    { idAbStopErrorCode },
    "(Eg. 412,421,521)",
    "CommonSettings",
    "text",
    "^\\d+(,\\d+)*$"
  )}
  ${generateTextInput(
    "No. of times error code should occur",
    3,
    { idAbStopErrorCodeCount },
    "<br />",
    "CommonSettings"
  )}
  ${generateTextInput(
    "Resume bot after error occurred",
    "",
    { idAbResumeAfterErrorOccured },
    "(S for seconds, M for Minutes, H for hours eg. 0-0S)<br/><br/>",
    "CommonSettings",
    "text",
    "\\d+-\\d+[H|M|S|h|m|s]$"
  )}
  ${generateTextInput(
      "Watch list ignore trade ids list",
      "",
      { idAbIgnoreTradeIds },
      "divide by comma",
      "CommonSettings",
      "text",
      "^\\d+(,\\d+)*$"
  )}
  ${generateToggleInput(
    "Auto Clear Log",
    { idAutoClearLog },
    "(Automatically clear logs <br/> every 2 minutes)",
    "CommonSettings"
  )}
  ${generateToggleInput(
    "Auto Clear Expired Items",
    { idAutoClearExpired },
    "(Automatically clear expired items <br/> from transfer targets)",
    "CommonSettings"
  )}
    ${generateTextInput(
      "Clear expired items",
      0,
      {idClearExpiredItems},
      "(0 - automatically clear)",
      "CommonSettings",
  )}
  ${generateToggleInput(
      "Cache FutBin prices by elapsed time",
      { idCacheFutBinPriceByElapsedTime },
      "",
      "CommonSettings"
    )
  }
  ${generateTextInput(
      "FutBin price cache time",
      25,
      {idFutBinPricesCacheTime},
      "(eg. 25 minutes)",
      "CommonSettings",
  )}
  ${generateToggleInput(
      "Prevent watch list overflow",
      {idAbPreventWatchListOverflow},
      "",
      "CommonSettings"
  )}
  ${generateToggleInput(
      "Prevent transfer list overflow",
      {idAbPreventTransferListOverflow},
      "",
      "BuyerSettings"
  )}
  </div>`;
};
