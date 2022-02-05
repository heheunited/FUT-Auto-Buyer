import {
    idAbBackendApiKey, idAbLongPollingCaptchaResolve,
} from "../../../elementIds.constants";
import {generateTextInput} from "../../../utils/uiUtils/generateTextInput";
import {generateToggleInput} from "../../../utils/uiUtils/generateToggleInput";

export const backendSettingsView = function () {
    return `<div style='display : none' class='buyer-settings-wrapper backend-settings-view'>  
    <hr class="search-price-header header-hr">
    <div class="search-price-header">
      <h1 class="secondary">Backend Settings:</h1>
    </div>
        ${generateTextInput(
        "API key",
        "",
        {idAbBackendApiKey},
        "API key for requests",
        "CommonSettings",
        "text"
    )}
        ${generateToggleInput(
        "Long Polling Captcha Resolve",
        {idAbLongPollingCaptchaResolve},
        "",
        "CommonSettings"
    )}
    `;
};
