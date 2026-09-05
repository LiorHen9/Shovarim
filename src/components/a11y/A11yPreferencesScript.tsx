import { A11Y_ATTR, A11Y_FONT_SCALE_VAR, A11Y_STORAGE_KEY } from "@/lib/a11y/constants";

// Blocking inline script, in the same spirit as the one next-themes injects, and for a
// stronger reason: a user who set the text to 150% because they cannot read it at 100%
// must not be shown a frame at 100% first. It runs synchronously before the rest of the
// body renders, so there is no flash.
//
// Written as a plain string rather than imported logic because it has to execute before
// any bundle loads. Every literal is templated in from src/lib/a11y/constants.ts, so the
// key and attribute names cannot drift from the module that writes them.
//
// Wrapped in try/catch throughout: localStorage throws outright in private-mode Safari,
// and this must never be the thing that stops a page from rendering.
const SCRIPT = `(function(){try{
var raw=localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)});if(!raw)return;
var p=JSON.parse(raw),r=document.documentElement;
if(p.fontScale>=1&&p.fontScale<=1.5)r.style.setProperty(${JSON.stringify(A11Y_FONT_SCALE_VAR)},String(p.fontScale));
if(p.highContrast===true)r.setAttribute(${JSON.stringify(A11Y_ATTR.contrast)},"high");
if(p.underlineLinks===true)r.setAttribute(${JSON.stringify(A11Y_ATTR.links)},"underline");
if(p.enhancedFocus===true)r.setAttribute(${JSON.stringify(A11Y_ATTR.focus)},"enhanced");
if(p.reduceMotion===true)r.setAttribute(${JSON.stringify(A11Y_ATTR.motion)},"reduce");
}catch(e){}})();`;

export function A11yPreferencesScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
