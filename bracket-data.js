/* Single source of truth for the bracket structure.
   Works in Node (module.exports) and the browser (window.BR). */
(function (factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  if (typeof window !== "undefined") window.BR = data;
})(function () {
  const T = {
    GER:{n:"Germany",f:"🇩🇪",s:"1E"}, PAR:{n:"Paraguay",f:"🇵🇾",s:"3D"},
    FRA:{n:"France",f:"🇫🇷",s:"1I"},  SWE:{n:"Sweden",f:"🇸🇪",s:"3F"},
    RSA:{n:"South Africa",f:"🇿🇦",s:"2A"}, CAN:{n:"Canada",f:"🇨🇦",s:"2B"},
    NED:{n:"Netherlands",f:"🇳🇱",s:"1F"}, MAR:{n:"Morocco",f:"🇲🇦",s:"2C"},
    BRA:{n:"Brazil",f:"🇧🇷",s:"1C"},   JPN:{n:"Japan",f:"🇯🇵",s:"2F"},
    CIV:{n:"Ivory Coast",f:"🇨🇮",s:"2E"}, NOR:{n:"Norway",f:"🇳🇴",s:"2I"},
    MEX:{n:"Mexico",f:"🇲🇽",s:"1A"},   ECU:{n:"Ecuador",f:"🇪🇨",s:"3E"},
    ENG:{n:"England",f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",s:"1L"}, COD:{n:"DR Congo",f:"🇨🇩",s:"3K"},
    POR:{n:"Portugal",f:"🇵🇹",s:"2K"}, CRO:{n:"Croatia",f:"🇭🇷",s:"2L"},
    ESP:{n:"Spain",f:"🇪🇸",s:"1H"},    AUT:{n:"Austria",f:"🇦🇹",s:"2J"},
    USA:{n:"USA",f:"🇺🇸",s:"1D"},      BIH:{n:"Bosnia & Herz.",f:"🇧🇦",s:"3B"},
    BEL:{n:"Belgium",f:"🇧🇪",s:"1G"},  SEN:{n:"Senegal",f:"🇸🇳",s:"3I"},
    ARG:{n:"Argentina",f:"🇦🇷",s:"1J"},CPV:{n:"Cape Verde",f:"🇨🇻",s:"2H"},
    AUS:{n:"Australia",f:"🇦🇺",s:"2D"},EGY:{n:"Egypt",f:"🇪🇬",s:"2G"},
    SUI:{n:"Switzerland",f:"🇨🇭",s:"1B"},ALG:{n:"Algeria",f:"🇩🇿",s:"3J"},
    COL:{n:"Colombia",f:"🇨🇴",s:"1K"}, GHA:{n:"Ghana",f:"🇬🇭",s:"3L"},
  };
  // Round of 32, top-to-bottom leaf order
  const R0 = [
    ["m74","GER","PAR"], ["m77","FRA","SWE"], ["m73","RSA","CAN"], ["m75","NED","MAR"],
    ["m76","BRA","JPN"], ["m78","CIV","NOR"], ["m79","MEX","ECU"], ["m80","ENG","COD"],
    ["m83","POR","CRO"], ["m84","ESP","AUT"], ["m81","USA","BIH"], ["m82","BEL","SEN"],
    ["m86","ARG","CPV"], ["m88","AUS","EGY"], ["m85","SUI","ALG"], ["m87","COL","GHA"],
  ];
  const KIDS = {
    m89:["m74","m77"], m90:["m73","m75"], m91:["m76","m78"], m92:["m79","m80"],
    m93:["m83","m84"], m94:["m81","m82"], m95:["m86","m88"], m96:["m85","m87"],
    m97:["m89","m90"], m99:["m91","m92"], m98:["m93","m94"], m100:["m95","m96"],
    m101:["m97","m99"], m102:["m98","m100"], m104:["m101","m102"],
  };
  const COLS = [
    R0.map(function(r){return r[0];}),
    ["m89","m90","m91","m92","m93","m94","m95","m96"],
    ["m97","m99","m98","m100"], ["m101","m102"], ["m104"],
  ];
  const ROUND_LABELS = [
    ["Round of 32","16 matches"],["Round of 16","8 matches"],
    ["Quarter-finals","Final 8"],["Semi-finals","Final 4"],["Final","MetLife"]
  ];
  const ROUND_WEIGHTS = [1, 2, 4, 8, 16]; // R32 -> Final
  const CHAMP = "m104";
  return { T:T, R0:R0, KIDS:KIDS, COLS:COLS, ROUND_LABELS:ROUND_LABELS, ROUND_WEIGHTS:ROUND_WEIGHTS, CHAMP:CHAMP };
});
