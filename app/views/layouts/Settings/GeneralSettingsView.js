import {idAbIsPlayerTypeSearch} from "../../../elementIds.constants";
import {generateToggleInput} from "../../../utils/uiUtils/generateToggleInput";

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
    `;
};
