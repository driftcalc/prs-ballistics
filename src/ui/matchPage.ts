// Match tab: prepare a match before the day, then read the stage cards.
//   #/match                  list of matches (+ New match)
//   #/match/<id>             one match: its stages, Update all cards, Print
//   #/match/<id>/stage/new   fast stage entry (also /stage/<n> to edit)
//   #/match/<id>/card/<n>    full-screen stage card, swipe between stages
import { BallisticsError } from '../ballistics/index.ts'
import { openSheet } from '../design/components.ts'
import { cardIsStale, type Match, type Stage } from '../data/match.ts'
import { newId, type RifleProfile } from '../data/profiles.ts'
import { currentProfile, getData, updateData, type AppData } from '../data/store.ts'
import { computeCard } from '../match/cards.ts'
import { parseOrder, parseTargets, targetsText } from '../match/parse.ts'
import { conditionsSummary, openConditionsSheet } from './conditionsSheet.ts'
import { escapeHtml } from './format.ts'
import { cardViewOf, printCards, shareCardImage, stageCardHtml, type CardView } from './stageCard.ts'
import { keepScreenAwake } from './wakeLock.ts'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

const findMatch = (d: AppData, id: string) => d.matches.find((m) => m.id === id)
const rifleOf = (d: AppData, m: Match): RifleProfile | undefined => d.profiles.find((p) => p.id === m.profileId)

/** Stages whose card exists but no longer fits the rifle, weather, wind speeds or targets. */
function staleStages(d: AppData, m: Match): Stage[] {
  const p = rifleOf(d, m)
  return m.stages.filter((s) => s.card && cardIsStale(s, p?.rifle, d.conditions, d.settings.cardWindsMph))
}

/** Works out one stage's card and saves it. Returns an error message, if any. */
async function computeAndSave(matchId: string, stageId: string): Promise<string | undefined> {
  const d = getData()
  const m = findMatch(d, matchId)
  const stage = m?.stages.find((s) => s.id === stageId)
  const p = m && rifleOf(d, m)
  if (!m || !stage) return undefined
  if (!p) return "This match's rifle was deleted. Pick a rifle under Details."
  try {
    const card = await computeCard(stage, p, d.conditions, d.settings.cardWindsMph)
    updateData((data) => {
      const s = findMatch(data, matchId)?.stages.find((x) => x.id === stageId)
      // Only keep it if the targets weren't edited again meanwhile.
      if (s && targetsText(s.targets) === targetsText(stage.targets)) s.card = card
    })
    return undefined
  } catch (e) {
    if (!(e instanceof BallisticsError)) console.error(e)
    return `${stage.name}: ${e instanceof BallisticsError ? e.message : 'could not work out the holds.'}`
  }
}

/** "Update all cards" (and first-time cards). Returns error messages. */
async function computeStages(matchId: string, stageIds: string[]): Promise<string[]> {
  const errors = await Promise.all(stageIds.map((id) => computeAndSave(matchId, id)))
  return errors.filter((e): e is string => !!e)
}

// Last deleted match, for Undo.
let deleted: { match: Match; index: number } | undefined

export function renderMatchPage(root: HTMLElement): void {
  const [, id, sub, n] = location.hash.replace(/^#\/?/, '').split('/')
  const d = getData()
  if (!d.profiles.length) {
    root.innerHTML = `<section class="card"><h2 class="card-title">Match</h2>
      <p>Add your rifle first. Then make a match here and get a stage card for each stage.</p>
      <a class="btn btn-primary big-button" href="#/rifles">Add a rifle</a></section>`
    return
  }
  const match = id ? findMatch(d, id) : undefined
  if (match && sub === 'stage') return renderStageEditor(root, match.id, n)
  if (match && sub === 'card') return renderCardView(root, match.id, Number(n) || 1)
  if (match) return renderMatch(root, match.id)
  renderList(root)
}

// ---------- Match list ----------

function renderList(root: HTMLElement): void {
  const d = getData()
  root.innerHTML = `
    ${
      deleted
        ? `<div class="banner" role="status"><p>Deleted “${escapeHtml(deleted.match.name)}”.</p>
            <button class="btn" type="button" data-action="undo">Undo</button></div>`
        : ''
    }
    <button class="btn btn-primary big-button" type="button" data-action="new">+ New match</button>
    <section class="card">
      <h2 class="card-title">Matches</h2>
      ${
        d.matches.length
          ? `<ul class="match-list">${d.matches
              .map((m) => {
                const rifle = rifleOf(d, m)?.name ?? 'rifle deleted'
                return `<li><a class="btn match-item" href="#/match/${m.id}"><strong>${escapeHtml(m.name)}</strong>
                  <span>${shortDate(m.date)} · ${m.stages.length} stage${m.stages.length === 1 ? '' : 's'} · ${escapeHtml(rifle)}</span></a></li>`
              })
              .join('')}</ul>`
          : `<p>No matches yet. Before match day, type each stage's targets once and get a stage card for your wrist coach.</p>`
      }
    </section>`

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (btn?.dataset.action === 'new') return openMatchDetails()
    if (btn?.dataset.action === 'undo' && deleted) {
      const { match, index } = deleted
      deleted = undefined
      updateData((data) => void data.matches.splice(Math.min(index, data.matches.length), 0, match))
      location.hash = `#/match/${match.id}`
    }
  })
}

/** New match (no id) or edit name / date / rifle (with Delete). */
function openMatchDetails(matchId?: string): void {
  const d = getData()
  const m = matchId ? findMatch(d, matchId) : undefined
  const rifleId = m?.profileId ?? currentProfile(d)?.id
  const sheet = openSheet({
    title: m ? 'Match details' : 'New match',
    content: `<form class="shot-form" novalidate>
        <label class="field"><span>Name</span>
          <input name="name" autocomplete="off" enterkeyhint="done" value="${escapeHtml(m?.name ?? `Match ${shortDate(today())}`)}" /></label>
        <label class="field"><span>Date</span><input name="date" type="date" value="${m?.date ?? today()}" /></label>
        <label class="field"><span>Rifle</span>
          <select name="rifle">${d.profiles
            .map((p) => `<option value="${p.id}"${p.id === rifleId ? ' selected' : ''}>${escapeHtml(p.name)}</option>`)
            .join('')}</select></label>
        <button class="btn btn-primary big-button" type="submit">${m ? 'Save' : 'Create · add stages ▸'}</button>
        ${m ? '<button class="btn btn-danger" type="button" data-action="delete">Delete match</button>' : ''}
      </form>`,
  })
  const form = sheet.body.querySelector('form')!
  const nameBox = form.querySelector<HTMLInputElement>('[name="name"]')!
  if (!m) {
    nameBox.focus()
    nameBox.select()
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const name = nameBox.value.trim() || `Match ${shortDate(today())}`
    const date = form.querySelector<HTMLInputElement>('[name="date"]')!.value || today()
    const profileId = form.querySelector<HTMLSelectElement>('[name="rifle"]')!.value
    if (m) {
      updateData((data) => void Object.assign(findMatch(data, m.id)!, { name, date, profileId }))
      sheet.closeAndGo(`#/match/${m.id}`)
      return
    }
    const id = newId()
    updateData((data) => void data.matches.unshift({ id, name, date, profileId, stages: [], createdAt: new Date().toISOString() }))
    sheet.closeAndGo(`#/match/${id}/stage/new`)
  })
  form.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    updateData((data) => {
      const index = data.matches.findIndex((x) => x.id === m!.id)
      if (index >= 0) deleted = { match: data.matches.splice(index, 1)[0], index }
    })
    sheet.closeAndGo('#/match')
  })
}

// ---------- One match ----------

function staleBanner(count: number): string {
  if (!count) return ''
  return `<div class="banner" role="status" data-stale>
    <p><strong>Conditions changed.</strong> ${count} card${count === 1 ? ' is' : 's are'} out of date.</p>
    <button class="btn btn-primary" type="button" data-action="update">Update all cards</button></div>`
}

function renderMatch(root: HTMLElement, matchId: string): void {
  const d = getData()
  const m = findMatch(d, matchId)!
  const rifle = rifleOf(d, m)
  const stale = staleStages(d, m)
  root.innerHTML = `
    <div class="match-head">
      <button class="btn info-btn" type="button" data-action="details" aria-haspopup="dialog">
        <span><strong>${escapeHtml(m.name)}</strong> · ${shortDate(m.date)} · ${escapeHtml(rifle?.name ?? 'rifle deleted')}</span><span aria-hidden="true">▸</span></button>
      <button class="btn info-btn" type="button" data-action="conditions" aria-haspopup="dialog" aria-label="Edit conditions">
        <span>${escapeHtml(conditionsSummary(d.conditions))}</span><span aria-hidden="true">▸</span></button>
    </div>
    ${rifle ? '' : `<div class="banner error" role="alert"><p>This match's rifle was deleted. Pick a rifle under the match details.</p></div>`}
    ${staleBanner(stale.length)}
    <ul class="errors" data-errors></ul>
    ${
      m.stages.length
        ? `<ol class="stage-list">${m.stages
            .map(
              (s, i) => `<li class="stage-item">
          <a class="btn stage-open" href="#/match/${m.id}/card/${i + 1}"><strong>${escapeHtml(s.name)}</strong>
            <span>${escapeHtml(s.targets.map((t) => `${t.name} ${t.rangeYd}`).join(' · '))}</span></a>
          <a class="btn stage-edit" href="#/match/${m.id}/stage/${i + 1}" aria-label="Edit ${escapeHtml(s.name)}">Edit</a></li>`,
            )
            .join('')}</ol>`
        : '<p>No stages yet.</p>'
    }
    <a class="btn btn-primary big-button" href="#/match/${m.id}/stage/new">+ Add stage</a>
    ${
      m.stages.length
        ? `<div class="match-actions">
            <a class="btn" href="#/match/${m.id}/card/1">Show cards</a>
            <button class="btn" type="button" data-action="print"${stale.length ? ' disabled' : ''}>Print 3×5 cards</button>
          </div>
          ${stale.length ? '<p class="hint">Update the cards before printing.</p>' : ''}`
        : ''
    }`

  const showErrors = (errors: string[]) => {
    const box = root.querySelector('[data-errors]')
    if (box) box.innerHTML = errors.map((er) => `<li>${escapeHtml(er)}</li>`).join('')
  }
  const rerender = () => {
    if (location.hash === `#/match/${matchId}`) renderMatch(freshRoot(root), matchId)
  }

  root.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    switch (btn?.dataset.action) {
      case 'details':
        return openMatchDetails(matchId)
      case 'conditions':
        return openConditionsSheet(() => {
          // Show the banner (and the new conditions) straight away; the sheet stays open.
          const now = getData()
          const fresh = findMatch(now, matchId)!
          root.querySelector('[data-action="conditions"] span')!.textContent = conditionsSummary(now.conditions)
          root.querySelector('[data-stale]')?.remove()
          root.querySelector('[data-errors]')!.insertAdjacentHTML('beforebegin', staleBanner(staleStages(now, fresh).length))
          root.querySelector<HTMLButtonElement>('[data-action="print"]')?.toggleAttribute('disabled', staleStages(now, fresh).length > 0)
        })
      case 'update': {
        btn!.disabled = true
        btn!.textContent = 'Working…'
        const errors = await computeStages(matchId, findMatch(getData(), matchId)!.stages.map((s) => s.id))
        rerender()
        return showErrors(errors)
      }
      case 'print': {
        const now = getData()
        const fresh = findMatch(now, matchId)!
        const views = fresh.stages
          .map((s, i) => cardViewOf(s, i + 1, fresh.stages.length, now.settings.angleUnit, now.settings.holdMode))
          .filter((v): v is CardView => !!v)
        return printCards(views)
      }
    }
  })

  // Stages without a card yet (just added, or a first try failed) get one now.
  const missing = m.stages.filter((s) => !s.card && s.targets.length).map((s) => s.id)
  if (missing.length && rifle) void computeStages(matchId, missing).then((errors) => (errors.length ? showErrors(errors) : rerender()))
}

/** Swaps in an empty copy of the page root so old click handlers don't pile up. */
function freshRoot(root: HTMLElement): HTMLElement {
  const fresh = root.cloneNode(false) as HTMLElement
  root.replaceWith(fresh)
  return fresh
}

// ---------- Stage entry ----------

function renderStageEditor(root: HTMLElement, matchId: string, n: string): void {
  const m0 = findMatch(getData(), matchId)!
  let index = n === 'new' ? -1 : Math.min(Math.max(Number(n) - 1, 0), m0.stages.length - 1)
  const editing = () => (index >= 0 ? findMatch(getData(), matchId)!.stages[index] : undefined)
  const nextNumber = () => findMatch(getData(), matchId)!.stages.length + 1

  const s0 = editing()
  root.innerHTML = `
    <form class="stage-form" novalidate>
      <p class="stage-form-where"><a href="#/match/${matchId}">${escapeHtml(m0.name)}</a> · <span data-where></span></p>
      <label class="field"><span>Stage name</span>
        <input name="name" autocomplete="off" enterkeyhint="next" value="${escapeHtml(s0?.name ?? `Stage ${nextNumber()}`)}" /></label>
      <label class="field"><span>Targets (name and yards)</span>
        <input name="targets" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next"
          placeholder="T1 611, T2 639, T3 700" value="${escapeHtml(s0 ? targetsText(s0.targets) : '')}" /></label>
      <p class="hint">Plain distances work too: <strong>611 639 700</strong> becomes T1, T2, T3.</p>
      <ul class="target-preview" data-preview aria-live="polite"></ul>
      <ul class="errors" data-problems></ul>
      <label class="field"><span>Shot order (optional)</span>
        <input name="order" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next"
          placeholder="T1, T3, T2, T1" value="${escapeHtml(s0?.order.join(', ') ?? '')}" /></label>
      <ul class="errors" data-order-problems></ul>
      <p class="ok-note" data-saved role="status"></p>
      <button class="btn btn-primary big-button" type="submit">Save · next stage ▸</button>
      <div class="actions">
        <button class="btn" type="button" data-action="done">Save · done</button>
        <a class="btn" href="#/match/${matchId}">Cancel</a>
        <button class="btn btn-danger" type="button" data-action="delete-stage"${s0 ? '' : ' hidden'}>Delete stage</button>
      </div>
    </form>`

  const form = root.querySelector('form')!
  const box = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)!
  const [nameBox, targetsBox, orderBox] = [box('name'), box('targets'), box('order')]
  const list = (sel: string, items: string[]) => (form.querySelector(sel)!.innerHTML = items.map((t) => `<li>${escapeHtml(t)}</li>`).join(''))

  const where = () => {
    const total = findMatch(getData(), matchId)!.stages.length
    form.querySelector('[data-where]')!.textContent = index >= 0 ? `Stage ${index + 1} of ${total}` : `New stage (${total} so far)`
  }
  const preview = (showProblems: boolean) => {
    const { targets, problems } = parseTargets(targetsBox.value)
    list('[data-preview]', targets.map((t) => `${t.name} ${t.rangeYd} yd`))
    list('[data-problems]', showProblems && targetsBox.value.trim() ? problems : [])
    return { targets, problems }
  }
  where()
  preview(false)

  // Returns true when saved.
  const save = (): boolean => {
    const { targets, problems } = preview(true)
    const all = targets.length ? problems : parseTargets('').problems
    list('[data-problems]', all)
    const order = parseOrder(orderBox.value, targets)
    list('[data-order-problems]', order.problems)
    if (all.length || order.problems.length) {
      ;(all.length ? targetsBox : orderBox).focus()
      return false
    }
    const name = nameBox.value.trim() || `Stage ${index >= 0 ? index + 1 : nextNumber()}`
    let stageId = ''
    updateData((data) => {
      const m = findMatch(data, matchId)!
      const existing = index >= 0 ? m.stages[index] : undefined
      if (existing) {
        const sameTargets = targetsText(existing.targets) === targetsText(targets)
        Object.assign(existing, { name, targets, order: order.order, card: sameTargets ? existing.card : undefined })
        stageId = existing.id
      } else {
        stageId = newId()
        m.stages.push({ id: stageId, name, targets, order: order.order })
      }
    })
    const savedId = stageId
    if (!editing()?.card) void computeAndSave(matchId, savedId)
    form.querySelector('[data-saved]')!.textContent = `✓ ${name} saved: ${targets.map((t) => `${t.name} ${t.rangeYd}`).join(' · ')}`
    return true
  }

  nameBox.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    targetsBox.focus()
  })
  targetsBox.addEventListener('input', () => preview(false))
  targetsBox.addEventListener('focus', () => list('[data-problems]', []))

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!save()) return
    // Blank form for the next stage, keyboard kept up (no page change).
    index = -1
    nameBox.value = `Stage ${nextNumber()}`
    targetsBox.value = ''
    orderBox.value = ''
    list('[data-preview]', [])
    form.querySelector<HTMLButtonElement>('[data-action="delete-stage"]')!.hidden = true
    history.replaceState(history.state, '', `#/match/${matchId}/stage/new`)
    where()
    targetsBox.focus()
  })

  form.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (btn?.dataset.action === 'done') {
      // A blank new stage (e.g. after the last one) just goes back; nothing to save.
      const blank = index < 0 && !targetsBox.value.trim() && !orderBox.value.trim()
      if (blank || save()) location.hash = `#/match/${matchId}`
    }
    if (btn?.dataset.action === 'delete-stage' && index >= 0) {
      updateData((data) => void findMatch(data, matchId)!.stages.splice(index, 1))
      location.hash = `#/match/${matchId}`
    }
  })

  // New stage: start typing targets straight away; the name is already filled in.
  if (!s0) targetsBox.focus()
}

// ---------- Full-screen card ----------

function renderCardView(root: HTMLElement, matchId: string, n: number): void {
  const d = getData()
  const m = findMatch(d, matchId)!
  if (!m.stages.length) {
    location.replace(`#/match/${matchId}`)
    return
  }
  const i = Math.min(Math.max(n, 1), m.stages.length)
  const stage = m.stages[i - 1]
  const view = cardViewOf(stage, i, m.stages.length, d.settings.angleUnit, d.settings.holdMode)
  const stale = staleStages(d, m).length

  root.innerHTML = `
    ${staleBanner(stale)}
    <ul class="errors" data-errors></ul>
    <div class="card-swipe" data-card>${view ? stageCardHtml(view) : `<p class="card-working">Working out ${escapeHtml(stage.name)}…</p>`}</div>
    <div class="card-tools">
      <button class="btn" type="button" data-action="share"${view ? '' : ' disabled'}>Share picture</button>
      <button class="btn" type="button" data-action="print"${view && !stale ? '' : ' disabled'}>Print card</button>
    </div>
    <nav class="card-nav" aria-label="Stages">
      <button class="btn" type="button" data-go="-1" aria-label="Previous stage"${i > 1 ? '' : ' disabled'}>◀</button>
      <a class="btn" href="#/match/${matchId}">All stages</a>
      <button class="btn" type="button" data-go="1" aria-label="Next stage"${i < m.stages.length ? '' : ' disabled'}>▶</button>
    </nav>`

  const go = (step: number) => {
    const next = i + step
    if (next >= 1 && next <= m.stages.length) location.replace(`#/match/${matchId}/card/${next}`)
  }
  const showErrors = (errors: string[]) => {
    root.querySelector('[data-errors]')!.innerHTML = errors.map((er) => `<li>${escapeHtml(er)}</li>`).join('')
  }
  const rerender = () => {
    if (location.hash === `#/match/${matchId}/card/${n}`) renderCardView(freshRoot(root), matchId, n)
  }

  root.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn) return
    if (btn.dataset.go) return go(Number(btn.dataset.go))
    if (btn.dataset.action === 'update') {
      btn.disabled = true
      btn.textContent = 'Working…'
      const errors = await computeStages(matchId, m.stages.map((s) => s.id))
      rerender()
      return showErrors(errors)
    }
    if (btn.dataset.action === 'print' && view) return printCards([view])
    if (btn.dataset.action === 'share' && view) {
      btn.disabled = true
      try {
        const how = await shareCardImage(view)
        btn.textContent = how === 'saved' ? 'Picture saved ✓' : 'Share picture'
      } catch (err) {
        console.error(err)
        btn.textContent = 'Could not make the picture'
      } finally {
        btn.disabled = false
      }
    }
  })

  // Swipe left / right between stages.
  const area = root.querySelector<HTMLElement>('[data-card]')!
  let start: { x: number; y: number } | undefined
  area.addEventListener('pointerdown', (e) => (start = { x: e.clientX, y: e.clientY }))
  area.addEventListener('pointerup', (e) => {
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    start = undefined
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  })
  area.addEventListener('pointercancel', () => (start = undefined))

  // Keep the screen on while a card is open.
  const release = keepScreenAwake()
  window.addEventListener('hashchange', release, { once: true })

  if (!view) {
    void computeAndSave(matchId, stage.id).then((err) => (err ? showErrors([err]) : rerender()))
  }
}
