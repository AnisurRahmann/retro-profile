import { GYM_UI } from "@/gym";

/**
 * Runs in <head> before first paint: marks JS as available, restores the theme (no flash),
 * and writes today's weekday in Asia/Dhaka to <html data-today> so the session chip is right from frame one.
 */
export const bootScript = `(function(){var d=document.documentElement;d.classList.add("js");try{if(localStorage.getItem("lights")==="dark")d.dataset.theme="dark"}catch(e){}try{d.dataset.today=new Intl.DateTimeFormat("en-US",{timeZone:"${GYM_UI.timeZone}",weekday:"long"}).format(new Date()).toLowerCase()}catch(e){}})()`;
