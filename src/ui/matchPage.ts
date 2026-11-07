// Match tab: placeholder until Match mode is built.
import { card } from '../design/components.ts'

export function renderMatchPage(root: HTMLElement): void {
  root.innerHTML = card(
    `<p>Match mode is coming soon: plan a stage's targets and distances ahead of time, then step through them on the line.</p>
     <p>For now, use <a href="#/shoot">Shoot</a> for holds and <a href="#/log">Log</a> to record your dope.</p>`,
    { title: 'Match mode' },
  )
}
