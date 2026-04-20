import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const imageDir = new URL("../images/", import.meta.url);
mkdirSync(imageDir, { recursive: true });

const palette = {
  ink: "#10151f",
  paper: "#f7f9fc",
  line: "#cfd7e6",
  green: "#2f9e44",
  blue: "#2563eb",
  red: "#d92d20",
  yellow: "#f59f00"
};

function writeSVG(name, body, width = 1200, height = 675) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${palette.paper}"/>
  ${body}
</svg>
`;
  const svgPath = join(imageDir.pathname, `${name}.svg`);
  const pngPath = join(imageDir.pathname, `${name}.png`);
  writeFileSync(svgPath, svg);
  execFileSync("convert", [svgPath, pngPath], { stdio: "inherit" });
}

writeSVG(
  "icon",
  `<rect x="0" y="0" width="128" height="128" rx="22" fill="${palette.ink}"/>
   <path d="M25 34h78v60H25z" fill="${palette.paper}" opacity="0.96"/>
   <path d="M38 52h24M38 66h52M38 80h36" stroke="${palette.ink}" stroke-width="7" stroke-linecap="round"/>
   <path d="M76 38v56M64 50h24M64 82h24" stroke="${palette.blue}" stroke-width="7" stroke-linecap="round"/>
   <circle cx="96" cy="32" r="11" fill="${palette.green}"/>`,
  128,
  128
);

const chrome = `<rect x="48" y="42" width="1104" height="591" rx="10" fill="#ffffff" stroke="${palette.line}" stroke-width="2"/>
<rect x="48" y="42" width="1104" height="44" rx="10" fill="${palette.ink}"/>
<circle cx="78" cy="64" r="7" fill="${palette.red}"/><circle cx="102" cy="64" r="7" fill="${palette.yellow}"/><circle cx="126" cy="64" r="7" fill="${palette.green}"/>`;

writeSVG(
  "screenshot-preview",
  `${chrome}
   <rect x="82" y="118" width="486" height="462" fill="#fbfcff" stroke="${palette.line}"/>
   <rect x="632" y="118" width="486" height="462" fill="#ffffff" stroke="${palette.line}"/>
   <text x="108" y="170" font-family="Inter,Arial" font-size="30" font-weight="700" fill="${palette.ink}"># Launch notes</text>
   <text x="108" y="224" font-family="monospace" font-size="22" fill="${palette.blue}">[[toc]]</text>
   <text x="108" y="280" font-family="monospace" font-size="22" fill="${palette.ink}">&gt; [!TIP] Preview tracks the source.</text>
   <text x="108" y="336" font-family="monospace" font-size="22" fill="${palette.ink}">:::details "Build"</text>
   <text x="108" y="390" font-family="monospace" font-size="22" fill="${palette.ink}">Run mdpp render --format=pdf</text>
   <text x="666" y="174" font-family="Inter,Arial" font-size="34" font-weight="700" fill="${palette.ink}">Launch notes</text>
   <rect x="666" y="214" width="360" height="88" rx="6" fill="#ecfdf3" stroke="#b7ebc6"/>
   <text x="690" y="266" font-family="Inter,Arial" font-size="22" fill="${palette.ink}">Preview tracks the source.</text>
   <rect x="666" y="338" width="392" height="128" rx="6" fill="#f8fafc" stroke="${palette.line}"/>
   <text x="690" y="396" font-family="Inter,Arial" font-size="22" fill="${palette.ink}">Build</text>
   <path d="M575 342h48" stroke="${palette.green}" stroke-width="8" stroke-linecap="round"/>`
);

writeSVG(
  "screenshot-lsp",
  `${chrome}
   <text x="92" y="150" font-family="monospace" font-size="24" fill="${palette.ink}">See [docs][missing] and note[^todo].</text>
   <path d="M202 160h178" stroke="${palette.red}" stroke-width="5"/>
   <path d="M482 160h86" stroke="${palette.red}" stroke-width="5"/>
   <rect x="94" y="210" width="438" height="140" rx="8" fill="#fff7ed" stroke="#fed7aa"/>
   <text x="118" y="260" font-family="Inter,Arial" font-size="24" font-weight="700" fill="${palette.ink}">MDPP106</text>
   <text x="118" y="304" font-family="Inter,Arial" font-size="22" fill="${palette.ink}">Missing reference definition.</text>
   <rect x="620" y="144" width="432" height="250" rx="8" fill="#f8fafc" stroke="${palette.line}"/>
   <text x="650" y="200" font-family="Inter,Arial" font-size="26" font-weight="700" fill="${palette.ink}">Quick fixes</text>
   <text x="650" y="252" font-family="Inter,Arial" font-size="23" fill="${palette.ink}">Create missing reference definition</text>
   <text x="650" y="304" font-family="Inter,Arial" font-size="23" fill="${palette.ink}">Create missing footnote definition</text>
   <text x="650" y="356" font-family="Inter,Arial" font-size="23" fill="${palette.ink}">Convert reference link to inline</text>`
);

writeSVG(
  "screenshot-hover",
  `${chrome}
   <text x="92" y="150" font-family="monospace" font-size="24" fill="${palette.ink}">## Architecture</text>
   <text x="92" y="204" font-family="monospace" font-size="24" fill="${palette.ink}">See [the parser](#architecture).</text>
   <rect x="416" y="132" width="520" height="250" rx="8" fill="#ffffff" stroke="${palette.line}"/>
   <text x="446" y="192" font-family="Inter,Arial" font-size="28" font-weight="700" fill="${palette.ink}">Heading</text>
   <text x="446" y="244" font-family="monospace" font-size="22" fill="${palette.blue}">#architecture</text>
   <text x="446" y="304" font-family="Inter,Arial" font-size="22" fill="${palette.ink}">Level 2 heading. Internal links resolve here.</text>
   <path d="M294 200c58 0 58-58 116-58" fill="none" stroke="${palette.green}" stroke-width="8" stroke-linecap="round"/>`
);

writeSVG(
  "screenshot-format",
  `${chrome}
   <rect x="88" y="126" width="486" height="410" fill="#fbfcff" stroke="${palette.line}"/>
   <rect x="626" y="126" width="486" height="410" fill="#ffffff" stroke="${palette.line}"/>
   <text x="120" y="182" font-family="monospace" font-size="22" fill="${palette.ink}">|  Name |Value |</text>
   <text x="120" y="232" font-family="monospace" font-size="22" fill="${palette.ink}">| :---: | ---: |</text>
   <text x="120" y="282" font-family="monospace" font-size="22" fill="${palette.ink}">- one</text>
   <text x="120" y="332" font-family="monospace" font-size="22" fill="${palette.ink}">   - two</text>
   <text x="662" y="182" font-family="monospace" font-size="22" fill="${palette.ink}">| Name | Value |</text>
   <text x="662" y="232" font-family="monospace" font-size="22" fill="${palette.ink}">|:---:|---:|</text>
   <text x="662" y="282" font-family="monospace" font-size="22" fill="${palette.ink}">- one</text>
   <text x="662" y="332" font-family="monospace" font-size="22" fill="${palette.ink}">  - two</text>
   <path d="M578 320h44" stroke="${palette.blue}" stroke-width="8" stroke-linecap="round"/>
   <text x="480" y="586" font-family="Inter,Arial" font-size="26" font-weight="700" fill="${palette.ink}">Format document with mdpp</text>`
);

writeSVG(
  "screenshot-pdf",
  `${chrome}
   <rect x="96" y="126" width="420" height="500" fill="#ffffff" stroke="${palette.line}"/>
   <text x="138" y="190" font-family="Inter,Arial" font-size="32" font-weight="700" fill="${palette.ink}">Research note</text>
   <line x1="138" y1="236" x2="448" y2="236" stroke="${palette.line}" stroke-width="3"/>
   <line x1="138" y1="286" x2="448" y2="286" stroke="${palette.line}" stroke-width="3"/>
   <line x1="138" y1="336" x2="348" y2="336" stroke="${palette.line}" stroke-width="3"/>
   <rect x="610" y="178" width="392" height="108" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
   <text x="646" y="244" font-family="Inter,Arial" font-size="28" font-weight="700" fill="${palette.ink}">Export to PDF</text>
   <path d="M535 362c78 0 78-92 156-92" fill="none" stroke="${palette.blue}" stroke-width="8" stroke-linecap="round"/>
   <path d="M682 244l26 26-26 26" fill="none" stroke="${palette.blue}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`
);
