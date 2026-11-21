// Wraps the Platane/snk snake in a card laid out like GitHub's own contribution panel:
// the total for the last year, month and day labels, the Less/More legend and the contribution years.
// Usage: node card.mjs <login> <dist dir>   (GITHUB_TOKEN in the environment)
import { readFileSync, writeFileSync } from 'node:fs';

const [login, dist] = process.argv.slice(2);
const query = `query($l:String!){user(login:$l){contributionsCollection{contributionYears
  contributionCalendar{totalContributions weeks{firstDay}}}}}`;
const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query, variables: { l: login } }),
});
const body = await res.json();
if (!body.data) throw new Error(`GraphQL: ${JSON.stringify(body.errors ?? body)}`);
const cc = body.data.user.contributionsCollection;
const total = cc.contributionCalendar.totalContributions;
const weeks = cc.contributionCalendar.weeks.map((w) => new Date(`${w.firstDay}T00:00:00Z`));
const years = cc.contributionYears.slice(0, 5);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 16, GX = 56, GY = 104;
const months = [];
weeks.forEach((d, c) => {
  const m = d.getUTCMonth();
  if (c === 0 || m !== weeks[c - 1].getUTCMonth()) months.push({ c, m });
});
// GitHub drops a first label that would collide with the next one.
if (months.length > 1 && months[1].c - months[0].c < 2) months.shift();

const THEMES = {
  dark: { src: 'github-snake-dark.svg', out: 'contributions-dark.svg', bg: '#0d1117', fg: '#e6edf3', muted: '#9198a1', border: '#3d444d', pill: '#1f6feb', pillFg: '#ffffff' },
  light: { src: 'github-snake.svg', out: 'contributions.svg', bg: '#ffffff', fg: '#1f2328', muted: '#59636e', border: '#d1d9e0', pill: '#0969da', pillFg: '#ffffff' },
};

const font = 'font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif"';
for (const t of Object.values(THEMES)) {
  const snake = readFileSync(`${dist}/${t.src}`, 'utf8');
  const palette = [0, 1, 2, 3, 4].map((i) => (snake.match(new RegExp(`--c${i}:(#[0-9a-fA-F]+)`)) ?? [])[1]);
  const inner = snake.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const gridW = weeks.length * CELL;
  const frameW = GX + gridW + 32;
  const W = frameW + 170;
  const H = 300;
  const legendY = GY + 7 * CELL + 36;
  const legendX = frameW - 32 - 5 * 15 - 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${font}>
<rect width="${W}" height="${H}" rx="10" fill="${t.bg}"/>
<text x="4" y="30" font-size="22" fill="${t.fg}">${total.toLocaleString('en-US')} contributions in the last year</text>
<rect x="0.5" y="52.5" width="${frameW}" height="${H - 62}" rx="8" fill="none" stroke="${t.border}"/>
${months.map(({ c, m }) => `<text x="${GX + c * CELL}" y="${GY - 12}" font-size="14" fill="${t.fg}">${MONTHS[m]}</text>`).join('\n')}
${[['Mon', 1], ['Wed', 3], ['Fri', 5]].map(([d, r]) => `<text x="${GX - 40}" y="${GY + r * CELL + 11}" font-size="14" fill="${t.fg}">${d}</text>`).join('\n')}
<svg x="${GX - 18}" y="${GY - 34}" width="880" height="192" viewBox="-16 -32 880 192" overflow="visible">${inner}</svg>
<text x="${GX}" y="${legendY}" font-size="14" fill="${t.muted}">Private contributions included · redrawn every day</text>
<text x="${legendX - 8}" y="${legendY}" font-size="14" fill="${t.muted}" text-anchor="end">Less</text>
${palette.map((c, i) => `<rect x="${legendX + i * 15}" y="${legendY - 11}" width="11" height="11" rx="2" fill="${c}"/>`).join('')}
<text x="${legendX + palette.length * 15 + 4}" y="${legendY}" font-size="14" fill="${t.muted}">More</text>
${years.map((y, i) => i === 0
    ? `<rect x="${frameW + 24}" y="52" width="140" height="38" rx="7" fill="${t.pill}"/><text x="${frameW + 44}" y="77" font-size="17" font-weight="600" fill="${t.pillFg}">${y}</text>`
    : `<text x="${frameW + 44}" y="${77 + i * 44}" font-size="17" fill="${t.muted}">${y}</text>`).join('\n')}
</svg>`;
  writeFileSync(`${dist}/${t.out}`, svg);
  console.log(`${t.out}: ${total} contributions, ${weeks.length} weeks, years ${years.join(' ')}`);
}
