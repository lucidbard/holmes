
/* for Mozilla/Opera9 */
if (document.addEventListener) {
    document.addEventListener("DOMContentLoaded", init, false);
}

/* for Safari */
if (/WebKit/i.test(navigator.userAgent)) { // sniff
    _timer = setInterval(function () {
        "use strict";
        if (/loaded|complete/.test(document.readyState)) {
            init(); // call the onload handler
        }
    }, 10);
}

/* for other browsers */
window.onload = init;
//# sourceURL=engine.js
