# Performance refactor summary

## 1. Scroll containers → FlatList (Home)

**File: `app/(tabs)/index.tsx`**

- **Replaced** the positions list (previously `ScrollView` + `positions.map()`) with **FlatList**.
- **ListHeaderComponent** holds all content above the list (header, summary card, refresh button, equity chart, "Positions" title), so there is **no nested ScrollView** and only one scroll container.
- **ListEmptyComponent** shows "No positions" when `positions.length === 0`.
- **Virtualization:** Only visible (and a small buffer of) position rows are mounted; the rest are unmounted to save memory and work.

**Improvements:**

- `initialNumToRender={10}` – few items rendered on first paint.
- `maxToRenderPerBatch={10}` – small batches when scrolling.
- `windowSize={5}` – viewport + 5 viewport heights of content kept in memory.
- `removeClippedSubviews={true}` – offscreen items are unmounted (Android mainly).
- `keyExtractor={(item) => item.symbol}` – stable keys, no index.
- `decelerationRate="normal"` – consistent scroll feel.
- `contentContainerStyle` uses `flexGrow: 1` when the list is empty so the empty state is visible.

## 2. Fewer re-renders (Home + Trade)

**Home – `app/(tabs)/index.tsx`**

- **PositionRow** is wrapped in **React.memo** so it only re-renders when its props change.
- **Stable callbacks:** `handlePositionPress(symbol)`, `renderItem`, `keyExtractor` are created with **useCallback** and stable deps so list items don’t re-render unnecessarily.
- **Stable list components:** `listHeaderComponent`, `listEmptyComponent`, `refreshControl` are built with **useMemo** so the header/empty/refresh UI isn’t recreated every render.
- **PositionRow** receives `onPress(symbol: string)` and `symbol` so the callback reference can stay stable while still navigating to the right position.

**Trade – `app/(tabs)/trade.tsx`**

- **DropdownItem** is a **React.memo** component so dropdown options don’t all re-render when the parent updates.
- **useMemo:** `symbolForApi`, `filteredSymbols`, `dropdownOptions`, `showDropdown` are memoized so heavy filtering and derived state aren’t recomputed every render.
- **useCallback:** `handleSymbolSelect`, `handleSymbolChangeText` are stable; the symbol input and dropdown use these instead of inline handlers.
- Dropdown row styles are in a **StyleSheet** (no inline style objects in the list).

## 3. No scroll conflicts

- **Home:** Only **FlatList** scrolls; header/chart are in `ListHeaderComponent`, so there is no nested ScrollView.
- **Trade / Position / Explore:** Still use a single **ScrollView** for the form/content; there is no FlatList inside ScrollView and no nested scroll views.

## 4. Animations

- **ParallaxScrollView** and **HelloWave** use **react-native-reanimated** (e.g. `useAnimatedStyle`, `useScrollOffset`). Reanimated runs on the UI thread; there is no `useNativeDriver` to set (it’s native by default).
- No React Native `Animated` API with `useNativeDriver` was changed; no new animations were added.

## 5. Images

- The app does **not** use `Image` from `react-native` in the main app UI (only asset paths in config).
- **expo-image** is already in the project; when you add images, prefer `expo-image` with e.g. `cachePolicy="memory-disk"` and fixed width/height to avoid layout shifts.

## 6. FlashList (optional next step)

- The positions list uses **FlatList** with the tuning above. If the list grows to **100+ items** or rows become more complex (e.g. many subviews, images), consider switching to **@shopify/flash-list**:
  - Install: `npx expo install @shopify/flash-list`
  - Replace `FlatList` with `FlashList`, set **estimatedItemSize** to the approximate row height (e.g. 72).
  - Keep the same `ListHeaderComponent`, `ListEmptyComponent`, `keyExtractor`, and memoized `renderItem` / `PositionRow`.

## 7. Behavioral regressions

- **Home:** Pull-to-refresh, empty state, chart, and navigation to `/position/[symbol]` behave as before; only the implementation of the list changed (ScrollView+map → FlatList).
- **Trade:** Symbol input, dropdown (top 5, symbol/name filter), selection, and sending only `symbol` to the API are unchanged; callbacks and memoization are internal optimizations only.

## Performance-critical changes (recap)

| Area              | Change                                                                 |
|-------------------|------------------------------------------------------------------------|
| List virtualization | Positions list is virtualized with FlatList and tuned props.        |
| Re-renders        | Memoized list items (PositionRow, DropdownItem) and stable callbacks.   |
| Derived state     | useMemo for filtered/mapped lists and dropdown visibility (Trade).     |
| Scroll structure  | Single scrollable (FlatList or ScrollView), no nested scroll.          |
| Keys              | keyExtractor by `item.symbol`, no array index.                         |
