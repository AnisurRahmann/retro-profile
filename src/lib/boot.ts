import { GYM_UI } from "@/gym";

/**
 * Runs in <head> before first paint: marks JS as available, restores the lights (no flash): the stored choice,
 * or the system colour scheme on a first visit. Lights off sets data-theme="dark" (interface tokens) and data-lights="off" (illustration palette),
 * and writes today's weekday in Asia/Dhaka to <html data-today> so the session chip is right from frame one.
 */
export const bootScript = `(function(){var d=document.documentElement;d.classList.add("js");var t=null;try{t=localStorage.getItem("lights")}catch(e){}if(t!=="dark"&&t!=="light"){try{t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){t="light"}}if(t==="dark"){d.dataset.theme="dark";d.dataset.lights="off"}try{d.dataset.today=new Intl.DateTimeFormat("en-US",{timeZone:"${GYM_UI.timeZone}",weekday:"long"}).format(new Date()).toLowerCase()}catch(e){}})()`;
