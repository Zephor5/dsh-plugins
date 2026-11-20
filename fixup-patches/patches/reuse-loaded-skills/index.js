export const name = 'fixup-reuse-loaded-skills'
export const inject = ['systemPrompt']

export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.section({
    name,
    order: 500,
    text: 'For an applicable skill, reuse its full instructions if they are already visible in your current context. A follow-up turn alone does not require another `skill` call. If only the catalog summary is visible or the instructions are missing, load the skill by its exact name before acting.',
    interpolate: false,
  }))
}
