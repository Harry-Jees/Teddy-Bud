# Client architecture notes

This folder contains the React Native application shared by Android, desktop, and web builds.

## Application boundaries

- `App.tsx` is the application shell. Keep it focused on session restoration, app-level state, navigation, and coordinating feature screens.
- `components/BrowserLoginScreen.tsx` owns the sign-in form UI. Authentication rules and credential storage remain in `services/browserAuth`.
- `components/ChatPresentation.tsx` contains message formatting and response feedback. Keep network and conversation state outside presentation components.
- `screens/WellbeingScreens.tsx` owns the journal and emotion check-in interfaces. Persistence is provided through typed callbacks; these screens must not reach into the database directly.
- `theme/appStyles.ts` is the shared style sheet. Add reusable styles there and keep design values aligned with `theme.ts`.
- `services/` contains platform, storage, authentication, gateway, and other side-effect boundaries.

## Performance rules

1. Keep optional screens behind `React.lazy` and render them inside `React.Suspense`.
2. Avoid adding heavy dependencies to the app entrypoint for a feature used only on one screen.
3. Keep render components presentational where possible; memoize only measured expensive work.
4. Avoid artificial loading delays. Use short transitions for perceived continuity, not fixed multi-second waits.
5. Do not move local-first data or security policy into UI components.

## Maintenance conventions

- Use named exports for reusable components and explicit prop types.
- Add short JSDoc comments to module boundaries and non-obvious lifecycle/security decisions. Prefer explaining *why* over narrating what the code already says.
- Keep comments current when behaviour changes; remove comments that no longer describe the implementation.
- Remove unused imports, declarations, dependencies, and styles when their last use is removed.
- Preserve platform behaviour and accessibility labels when extracting components.
- Run lint, type checks, unit tests, and platform builds before merging. A source refactor is not considered verified until the relevant CI jobs pass.
