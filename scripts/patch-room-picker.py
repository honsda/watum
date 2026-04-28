import re

with open('src/routes/+page.svelte', 'r') as f:
    content = f.read()

# 1. Remove getAllClassRooms from imports
content = content.replace(
    "\timport {\n\t\tgetClassRooms,\n\t\tgetAllClassRooms,\n\t\tgetClassRoom,",
    "\timport {\n\t\tgetClassRooms,\n\t\tgetClassRoom,"
)

# 2. Remove requiresBuilderClassrooms from ViewDataPlan type
content = content.replace(
    """\ttype ViewDataPlan = {
\t\tcollections: DataCollectionKey[];
\t\trequiresSchedulePreview: boolean;
\t\trequiresBuilderClassrooms: boolean;
\t\trequiresRoomDashboardMetrics: boolean;
\t\trequiresRoomDashboardSummary: boolean;
\t\trequiresAdminDashboardTotals: boolean;
\t};""",
    """\ttype ViewDataPlan = {
\t\tcollections: DataCollectionKey[];
\t\trequiresSchedulePreview: boolean;
\t\trequiresRoomDashboardMetrics: boolean;
\t\trequiresRoomDashboardSummary: boolean;
\t\trequiresAdminDashboardTotals: boolean;
\t};"""
)

# 3. Remove includeBuilderClassrooms from RefreshDependencies
content = content.replace(
    """\ttype RefreshDependencies = {
\t\tcollections?: DataCollectionKey[];
\t\tincludeSchedulePreview?: boolean;
\t\tincludeBuilderClassrooms?: boolean;
\t\tincludeRoomDashboardMetrics?: boolean;
\t\tincludeRoomDashboardSummary?: boolean;
\t\tincludeAdminDashboardTotals?: boolean;
\t\tincludeConflictAudit?: boolean;
\t\tforceCollections?: boolean;
\t};""",
    """\ttype RefreshDependencies = {
\t\tcollections?: DataCollectionKey[];
\t\tincludeSchedulePreview?: boolean;
\t\tincludeRoomDashboardMetrics?: boolean;
\t\tincludeRoomDashboardSummary?: boolean;
\t\tincludeAdminDashboardTotals?: boolean;
\t\tincludeConflictAudit?: boolean;
\t\tforceCollections?: boolean;
\t};"""
)

# 4. Replace builderClassrooms state with server-side search state
content = content.replace(
    "\tlet builderClassrooms = $state<SelectClassRoomsResult[]>([]);\n\tlet builderClassroomsLoaded = $state(false);",
    """\t// Server-side paginated room search for pickers
\tlet roomPickerSource = $state<SelectClassRoomsResult[]>([]);
\tlet roomPickerCursor = $state<string | null>(null);
\tlet roomPickerHasMore = $state(false);
\tlet roomPickerSearchTimer: number | null = null;

\tlet scheduleRoomFilterSource = $state<SelectClassRoomsResult[]>([]);
\tlet scheduleRoomFilterCursor = $state<string | null>(null);
\tlet scheduleRoomFilterHasMore = $state(false);
\tlet scheduleRoomFilterSearchTimer: number | null = null;"""
)

# 5. Update resetCollections
content = content.replace(
    "\t\tbuilderClassrooms = [];\n\t\tbuilderClassroomsLoaded = false;",
    """\t\troomPickerSource = [];
\t\troomPickerCursor = null;
\t\troomPickerHasMore = false;
\t\tscheduleRoomFilterSource = [];
\t\tscheduleRoomFilterCursor = null;
\t\tscheduleRoomFilterHasMore = false;"""
)

# 6. Remove refreshBuilderClassrooms function and replace with fetchRoomPage
content = content.replace(
    """\tasync function refreshBuilderClassrooms() {
\t\tbuilderClassrooms = await resolveRemoteQuery(getAllClassRooms());
\t\tbuilderClassroomsLoaded = true;
\t}""",
    """\tasync function fetchRoomPage(
\t\tquery: string,
\t\tcursor: string | null,
\t\ttarget: 'picker' | 'filter'
\t) {
\t\tconst setResults =
\t\t\ttarget === 'picker'
\t\t\t\t? (items: SelectClassRoomsResult[]) => (roomPickerSource = items)
\t\t\t\t: (items: SelectClassRoomsResult[]) => (scheduleRoomFilterSource = items);
\t\tconst setHasMore =
\t\t\ttarget === 'picker'
\t\t\t\t? (v: boolean) => (roomPickerHasMore = v)
\t\t\t\t: (v: boolean) => (scheduleRoomFilterHasMore = v);
\t\tconst setCursor =
\t\t\ttarget === 'picker'
\t\t\t\t? (c: string | null) => (roomPickerCursor = c)
\t\t\t\t: (c: string | null) => (scheduleRoomFilterCursor = c);

\t\ttry {
\t\t\tconst result = await resolveRemoteQuery(
\t\t\t\tsearchClassRooms({
\t\t\t\t\tq: query || undefined,
\t\t\t\t\tcursor: cursor ?? undefined
\t\t\t\t})
\t\t\t);
\t\t\tsetResults(result.items as SelectClassRoomsResult[]);
\t\t\tsetHasMore(result.hasMore);
\t\t\tsetCursor(result.nextCursor ?? null);
\t\t} catch (e) {
\t\t\tconsole.error('Room search failed:', e);
\t\t\tsetResults([]);
\t\t\tsetHasMore(false);
\t\t\tsetCursor(null);
\t\t}
\t}"""
)

# 7. Remove requiresBuilderClassrooms from all view plans (replace all occurrences of the line)
content = content.replace("\t\t\trequiresBuilderClassrooms: false,\n\t\t\t\trequiresRoomDashboardMetrics: false,", "\t\t\trequiresRoomDashboardMetrics: false,")
content = content.replace("\t\t\trequiresBuilderClassrooms: true,\n\t\t\t\trequiresRoomDashboardMetrics: false,", "\t\t\trequiresRoomDashboardMetrics: false,")
content = content.replace("\t\t\trequiresBuilderClassrooms: false,\n\t\t\t\trequiresRoomDashboardMetrics: role !== 'STUDENT',", "\t\t\trequiresRoomDashboardMetrics: role !== 'STUDENT',")

# 8. Remove builderClassrooms loading from ensureViewData
content = content.replace(
    """\t\tif (plan.requiresBuilderClassrooms && (force || !builderClassroomsLoaded)) {
\t\t\ttasks.push(
\t\t\t\trefreshBuilderClassrooms().catch((error) => {
\t\t\t\t\tsetCollectionIssue('classrooms', errorMessage(error, 'Daftar ruang kelas gagal dimuat.'));
\t\t\t\t})
\t\t\t);
\t\t}

\t\tif (plan.requiresRoomDashboardSummary && (force || !roomDashboardSummaryLoaded)) {""",
    "\t\tif (plan.requiresRoomDashboardSummary && (force || !roomDashboardSummaryLoaded)) {"
)

# 9. Remove refreshBuilderClassroomsData function
content = content.replace(
    """\tasync function refreshBuilderClassroomsData(force = false) {
\t\tif (!force && !builderClassroomsLoaded) return;
\t\ttry {
\t\t\tawait refreshBuilderClassrooms();
\t\t\tclearCollectionIssue('classrooms');
\t\t} catch (error) {
\t\t\tsetCollectionIssue('classrooms', errorMessage(error, 'Daftar ruang kelas gagal dimuat.'));
\t\t\tthrow error;
\t\t}
\t}

\tasync function refreshRoomDashboardSummaryData(force = false) {""",
    "\tasync function refreshRoomDashboardSummaryData(force = false) {"
)

# 10. Remove includeBuilderClassrooms from refreshDependencies signature and body
content = content.replace(
    """\tasync function refreshDependencies({
\t\tcollections = [],
\t\tincludeSchedulePreview = false,
\t\tincludeBuilderClassrooms = false,
\t\tincludeRoomDashboardMetrics = false,
\t\tincludeRoomDashboardSummary = false,
\t\tincludeAdminDashboardTotals = false,
\t\tincludeConflictAudit = false,
\t\tforceCollections = false
\t}: RefreshDependencies) {
\t\tconst tasks: Promise<unknown>[] = [];
\t\tfor (const key of new Set(collections)) {
\t\t\ttasks.push(refreshCollectionData(key, forceCollections));
\t\t}
\t\tif (includeBuilderClassrooms) {
\t\t\ttasks.push(refreshBuilderClassroomsData(forceCollections));
\t\t}
\t\tif (includeRoomDashboardSummary) {""",
    """\tasync function refreshDependencies({
\t\tcollections = [],
\t\tincludeSchedulePreview = false,
\t\tincludeRoomDashboardMetrics = false,
\t\tincludeRoomDashboardSummary = false,
\t\tincludeAdminDashboardTotals = false,
\t\tincludeConflictAudit = false,
\t\tforceCollections = false
\t}: RefreshDependencies) {
\t\tconst tasks: Promise<unknown>[] = [];
\t\tfor (const key of new Set(collections)) {
\t\t\ttasks.push(refreshCollectionData(key, forceCollections));
\t\t}
\t\tif (includeRoomDashboardSummary) {"""
)

# 11. Remove includeBuilderClassrooms from refreshViewData
content = content.replace(
    """\t\t\tcollections: plan.collections,
\t\t\tincludeSchedulePreview: plan.requiresSchedulePreview,
\t\t\tincludeBuilderClassrooms: plan.requiresBuilderClassrooms,
\t\t\tincludeRoomDashboardSummary: plan.requiresRoomDashboardSummary,""",
    """\t\t\tcollections: plan.collections,
\t\t\tincludeSchedulePreview: plan.requiresSchedulePreview,
\t\t\tincludeRoomDashboardSummary: plan.requiresRoomDashboardSummary,"""
)

# 12. Remove includeBuilderClassrooms from createClassRoomEnhance and updateClassRoomEnhance
content = content.replace(
    """\tconst createClassRoomEnhance = createEnhancer(createClassRoom, async () => {
\t\tawait refreshDependencies({
\t\t\tcollections: ['classrooms', 'enrollments'],
\t\t\tincludeSchedulePreview: true,
\t\t\tincludeBuilderClassrooms: true,
\t\t\tincludeRoomDashboardSummary: true,
\t\t\tincludeRoomDashboardMetrics: true,
\t\t\tincludeAdminDashboardTotals: true,
\t\t\tincludeConflictAudit: true
\t\t});""",
    """\tconst createClassRoomEnhance = createEnhancer(createClassRoom, async () => {
\t\tawait refreshDependencies({
\t\t\tcollections: ['classrooms', 'enrollments'],
\t\t\tincludeSchedulePreview: true,
\t\t\tincludeRoomDashboardSummary: true,
\t\t\tincludeRoomDashboardMetrics: true,
\t\t\tincludeAdminDashboardTotals: true,
\t\t\tincludeConflictAudit: true
\t\t});"""
)
content = content.replace(
    """\tconst updateClassRoomEnhance = createEnhancer(updateClassRoom, async () => {
\t\tawait refreshDependencies({
\t\t\tcollections: ['classrooms', 'enrollments'],
\t\t\tincludeSchedulePreview: true,
\t\t\tincludeBuilderClassrooms: true,
\t\t\tincludeRoomDashboardSummary: true,
\t\t\tincludeRoomDashboardMetrics: true,
\t\t\tincludeAdminDashboardTotals: true,
\t\t\tincludeConflictAudit: true
\t\t});""",
    """\tconst updateClassRoomEnhance = createEnhancer(updateClassRoom, async () => {
\t\tawait refreshDependencies({
\t\t\tcollections: ['classrooms', 'enrollments'],
\t\t\tincludeSchedulePreview: true,
\t\t\tincludeRoomDashboardSummary: true,
\t\t\tincludeRoomDashboardMetrics: true,
\t\t\tincludeAdminDashboardTotals: true,
\t\t\tincludeConflictAudit: true
\t\t});"""
)

# 13. Update roomPickerLookup to use new sources
content = content.replace(
    """\tconst roomPickerLookup = $derived.by(() => {
\t\tconst lookup = new Map<string, SelectClassRoomsResult>();
\t\tfor (const item of builderClassroomsLoaded ? builderClassrooms : classrooms) {
\t\t\tif (item.id) lookup.set(item.id, item);
\t\t}
\t\treturn lookup;
\t});""",
    """\tconst roomPickerLookup = $derived.by(() => {
\t\tconst lookup = new Map<string, SelectClassRoomsResult>();
\t\tfor (const item of classrooms) {
\t\t\tif (item.id) lookup.set(item.id, item);
\t\t}
\t\tfor (const item of roomPickerSource) {
\t\t\tif (item.id) lookup.set(item.id, item);
\t\t}
\t\tfor (const item of scheduleRoomFilterSource) {
\t\t\tif (item.id) lookup.set(item.id, item);
\t\t}
\t\treturn lookup;
\t});"""
)

# 14. Update availableRoomOptions to use roomPickerSource
content = content.replace(
    """\tconst availableRoomOptions = $derived.by(() => {
\t\tconst roomOptions = builderClassroomsLoaded ? builderClassrooms : classrooms;
\t\tif (!enrollmentDraft.startTime || !enrollmentDraft.endTime) return roomOptions;""",
    """\tconst availableRoomOptions = $derived.by(() => {
\t\tconst roomOptions = roomPickerSource.length ? roomPickerSource : classrooms;
\t\tif (!enrollmentDraft.startTime || !enrollmentDraft.endTime) return roomOptions;"""
)

# 15. Update filteredScheduleRoomFilterOptions to use scheduleRoomFilterSource
content = content.replace(
    """\tconst filteredScheduleRoomFilterOptions = $derived.by(() =>
\t\t(builderClassroomsLoaded ? builderClassrooms : classrooms).filter((item) =>
\t\t\troomOptionMatches(item, scheduleRoomFilterSearch)
\t\t)
\t);""",
    """\tconst filteredScheduleRoomFilterOptions = $derived.by(() =>
\t\t(scheduleRoomFilterSource.length ? scheduleRoomFilterSource : classrooms).filter((item) =>
\t\t\troomOptionMatches(item, scheduleRoomFilterSearch)
\t\t)
\t);"""
)

# 16. Update room picker event handlers
content = content.replace(
    """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\toninput={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerSearch = (e.currentTarget as HTMLInputElement).value;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tif (enrollmentDraft.classRoomId) enrollmentDraft.classRoomId = '';
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonfocus={() => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}""",
    """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\toninput={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerSearch = (e.currentTarget as HTMLInputElement).value;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tif (enrollmentDraft.classRoomId) enrollmentDraft.classRoomId = '';
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tif (roomPickerSearchTimer) clearTimeout(roomPickerSearchTimer);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerSearchTimer = window.setTimeout(() => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvoid fetchRoomPage(roomPickerSearch, null, 'picker');
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}, 200);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonfocus={() => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvoid fetchRoomPage('', null, 'picker');
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}"""
)

# 17. Update room picker pagination
content = content.replace(
    """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdisabled={!roomPickerHasPreviousPage}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonmousedown={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\te.preventDefault();
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage = Math.max(roomPickerPage - 1, 0);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tSebelumnya
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclass="combobox-more"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdisabled={!roomPickerHasNextPage}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonmousedown={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\te.preventDefault();
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage += 1;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}""",
    """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdisabled={!roomPickerHasPreviousPage}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonmousedown={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\te.preventDefault();
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tconst prevPage = Math.max(roomPickerPage - 1, 0);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage = prevPage;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tSebelumnya
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclass="combobox-more"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdisabled={!roomPickerHasNextPage}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonmousedown={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\te.preventDefault();
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tconst nextPage = roomPickerPage + 1;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\troomPickerPage = nextPage;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}"""
)

# 18. Update schedule room filter event handlers
content = content.replace(
    """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\toninput={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterSearch = (e.currentTarget as HTMLInputElement).value;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tif (scheduleRoomFilter) {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilter = '';
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tqueueCollectionRefresh('enrollments', 0);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonfocus={() => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}""",
    """\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\toninput={(e) => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterSearch = (e.currentTarget as HTMLInputElement).value;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tif (scheduleRoomFilter) {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilter = '';
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tqueueCollectionRefresh('enrollments', 0);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tif (scheduleRoomFilterSearchTimer) clearTimeout(scheduleRoomFilterSearchTimer);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterSearchTimer = window.setTimeout(() => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvoid fetchRoomPage(scheduleRoomFilterSearch, null, 'filter');
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}, 200);
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonfocus={() => {
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterOpen = true;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tscheduleRoomFilterPage = 0;
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tvoid fetchRoomPage('', null, 'filter');
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t}}"""
)

with open('src/routes/+page.svelte', 'w') as f:
    f.write(content)

print("Done")
