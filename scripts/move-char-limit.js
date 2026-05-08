const fs = require(fs);
const path = src/pages/InquirySettingsPage.tsx;
let s = fs.readFileSync(path, utf8);
let changed = false;
function apply(label, fn){
  const before = s; s = fn(s); if(s !== before){ console.log(Applied:, label); changed = true; } else { console.log(No-op:, label); }
}
// 1) Insert Character Limit block immediately after the Field Type select container
apply(insert
