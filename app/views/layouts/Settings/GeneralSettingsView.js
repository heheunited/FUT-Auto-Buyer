import {
    idAbIsPlayerTypeSearch,
    idAbOverflowingPassiveMod,
    idAbWaitUntilWatchlistWillBeEmpty, idAbWaitUntilWatchlistWillBeEmptyRequestLimit
} from "../../../elementIds.constants";
import {generateToggleInput} from "../../../utils/uiUtils/generateToggleInput";
import {generateTextInput} from "../../../utils/uiUtils/generateTextInput";

export const generalSettingsView = function () {
    return `<div style='display : none' class='buyer-settings-wrapper general-settings-view'>  
    <hr class="search-price-header header-hr">
    <div class="search-price-header">
      <h1 class="secondary">General Settings:</h1>
    </div>
         ${generateToggleInput(
        "Is player type search",
        {idAbIsPlayerTypeSearch},
        "",
        "BuyerSettings"
    )}
             ${generateToggleInput(
        "Overflowing passive mod",
        {idAbOverflowingPassiveMod},
        "Passive mod, if TL/WL overflowed",
        "BuyerSettings"
    )}
         ${generateToggleInput(
        "Wait until watch list will be empty",
        {idAbWaitUntilWatchlistWillBeEmpty},
        "Pause, if watch list is empty",
        "BuyerSettings"
    )}
     
       ${generateTextInput(
        "Wait until request limit",
        10,
        {idAbWaitUntilWatchlistWillBeEmptyRequestLimit},
        "",
        "BuyerSettings"
    )}
    `;
};
