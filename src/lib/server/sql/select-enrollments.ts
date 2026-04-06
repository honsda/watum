import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectEnrollmentsDynamicParams = {
    select?: SelectEnrollmentsSelect;
    where?: SelectEnrollmentsWhere[];
}

export type SelectEnrollmentsResult = {
    id?: string;
    student_id?: string;
    course_id?: string;
    lecturer_id?: string;
    class_room_id?: string;
    schedule_id?: string;
    semester?: string;
    academic_year?: string;
    student_name?: string;
    study_program_name?: string;
    course_name?: string;
    course_credits?: number;
    lecturer_name?: string;
    class_room_name?: string;
    schedule_day?: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    schedule_start_time?: Date;
    schedule_end_time?: Date;
    grade_id?: string;
    letter_grade?: string;
}

export type SelectEnrollmentsSelect = {
    id?: boolean;
    student_id?: boolean;
    course_id?: boolean;
    lecturer_id?: boolean;
    class_room_id?: boolean;
    schedule_id?: boolean;
    semester?: boolean;
    academic_year?: boolean;
    student_name?: boolean;
    study_program_name?: boolean;
    course_name?: boolean;
    course_credits?: boolean;
    lecturer_name?: boolean;
    class_room_name?: boolean;
    schedule_day?: boolean;
    schedule_start_time?: boolean;
    schedule_end_time?: boolean;
    grade_id?: boolean;
    letter_grade?: boolean;
}

const selectFragments = {
    id: `e.id`,
    student_id: `e.student_id`,
    course_id: `e.course_id`,
    lecturer_id: `e.lecturer_id`,
    class_room_id: `e.class_room_id`,
    schedule_id: `e.schedule_id`,
    semester: `e.semester`,
    academic_year: `e.academic_year`,
    student_name: `s.name`,
    study_program_name: `sp.name`,
    course_name: `c.name`,
    course_credits: `c.credits`,
    lecturer_name: `l.name`,
    class_room_name: `cr.name`,
    schedule_day: `sch.day`,
    schedule_start_time: `sch.start_time`,
    schedule_end_time: `sch.end_time`,
    grade_id: `g.id`,
    letter_grade: `g.letter_grade`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectEnrollmentsWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['student_id', StringOperator, string | null]
    | ['student_id', SetOperator, string[]]
    | ['student_id', BetweenOperator, string | null, string | null]
    | ['course_id', StringOperator, string | null]
    | ['course_id', SetOperator, string[]]
    | ['course_id', BetweenOperator, string | null, string | null]
    | ['lecturer_id', StringOperator, string | null]
    | ['lecturer_id', SetOperator, string[]]
    | ['lecturer_id', BetweenOperator, string | null, string | null]
    | ['class_room_id', StringOperator, string | null]
    | ['class_room_id', SetOperator, string[]]
    | ['class_room_id', BetweenOperator, string | null, string | null]
    | ['schedule_id', StringOperator, string | null]
    | ['schedule_id', SetOperator, string[]]
    | ['schedule_id', BetweenOperator, string | null, string | null]
    | ['semester', StringOperator, string | null]
    | ['semester', SetOperator, string[]]
    | ['semester', BetweenOperator, string | null, string | null]
    | ['academic_year', StringOperator, string | null]
    | ['academic_year', SetOperator, string[]]
    | ['academic_year', BetweenOperator, string | null, string | null]
    | ['student_name', StringOperator, string | null]
    | ['student_name', SetOperator, string[]]
    | ['student_name', BetweenOperator, string | null, string | null]
    | ['study_program_name', StringOperator, string | null]
    | ['study_program_name', SetOperator, string[]]
    | ['study_program_name', BetweenOperator, string | null, string | null]
    | ['course_name', StringOperator, string | null]
    | ['course_name', SetOperator, string[]]
    | ['course_name', BetweenOperator, string | null, string | null]
    | ['course_credits', NumericOperator, number | null]
    | ['course_credits', SetOperator, number[]]
    | ['course_credits', BetweenOperator, number | null, number | null]
    | ['lecturer_name', StringOperator, string | null]
    | ['lecturer_name', SetOperator, string[]]
    | ['lecturer_name', BetweenOperator, string | null, string | null]
    | ['class_room_name', StringOperator, string | null]
    | ['class_room_name', SetOperator, string[]]
    | ['class_room_name', BetweenOperator, string | null, string | null]
    | ['schedule_day', StringOperator, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | null]
    | ['schedule_day', SetOperator, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU'[]]
    | ['schedule_day', BetweenOperator, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | null, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | null]
    | ['schedule_start_time', NumericOperator, Date | null]
    | ['schedule_start_time', SetOperator, Date[]]
    | ['schedule_start_time', BetweenOperator, Date | null, Date | null]
    | ['schedule_end_time', NumericOperator, Date | null]
    | ['schedule_end_time', SetOperator, Date[]]
    | ['schedule_end_time', BetweenOperator, Date | null, Date | null]
    | ['grade_id', StringOperator, string | null]
    | ['grade_id', SetOperator, string[]]
    | ['grade_id', BetweenOperator, string | null, string | null]
    | ['letter_grade', StringOperator, string | null]
    | ['letter_grade', SetOperator, string[]]
    | ['letter_grade', BetweenOperator, string | null, string | null]

export async function selectEnrollments(connection: Connection, params?: SelectEnrollmentsDynamicParams): Promise<SelectEnrollmentsResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `e.id`);
    }
    if (params?.select == null || params.select.student_id) {
        sql = appendSelect(sql, `e.student_id`);
    }
    if (params?.select == null || params.select.course_id) {
        sql = appendSelect(sql, `e.course_id`);
    }
    if (params?.select == null || params.select.lecturer_id) {
        sql = appendSelect(sql, `e.lecturer_id`);
    }
    if (params?.select == null || params.select.class_room_id) {
        sql = appendSelect(sql, `e.class_room_id`);
    }
    if (params?.select == null || params.select.schedule_id) {
        sql = appendSelect(sql, `e.schedule_id`);
    }
    if (params?.select == null || params.select.semester) {
        sql = appendSelect(sql, `e.semester`);
    }
    if (params?.select == null || params.select.academic_year) {
        sql = appendSelect(sql, `e.academic_year`);
    }
    if (params?.select == null || params.select.student_name) {
        sql = appendSelect(sql, `s.name AS student_name`);
    }
    if (params?.select == null || params.select.study_program_name) {
        sql = appendSelect(sql, `sp.name AS study_program_name`);
    }
    if (params?.select == null || params.select.course_name) {
        sql = appendSelect(sql, `c.name AS course_name`);
    }
    if (params?.select == null || params.select.course_credits) {
        sql = appendSelect(sql, `c.credits AS course_credits`);
    }
    if (params?.select == null || params.select.lecturer_name) {
        sql = appendSelect(sql, `l.name AS lecturer_name`);
    }
    if (params?.select == null || params.select.class_room_name) {
        sql = appendSelect(sql, `cr.name AS class_room_name`);
    }
    if (params?.select == null || params.select.schedule_day) {
        sql = appendSelect(sql, `sch.day AS schedule_day`);
    }
    if (params?.select == null || params.select.schedule_start_time) {
        sql = appendSelect(sql, `sch.start_time AS schedule_start_time`);
    }
    if (params?.select == null || params.select.schedule_end_time) {
        sql = appendSelect(sql, `sch.end_time AS schedule_end_time`);
    }
    if (params?.select == null || params.select.grade_id) {
        sql = appendSelect(sql, `g.id as grade_id`);
    }
    if (params?.select == null || params.select.letter_grade) {
        sql = appendSelect(sql, `g.letter_grade as letter_grade`);
    }
    sql += EOL + `FROM enrollments e`;
    if (params?.select == null
        || params.select.student_name
        || params.select.study_program_name
        || where.student_name != null
        || where.study_program_name != null) {
        sql += EOL + `INNER JOIN students s on e.student_id = s.id`;
    }
    if (params?.select == null
        || params.select.study_program_name
        || where.study_program_name != null) {
        sql += EOL + `INNER JOIN study_programs sp ON s.study_program_id = sp.id`;
    }
    if (params?.select == null
        || params.select.course_name
        || params.select.course_credits
        || where.course_name != null
        || where.course_credits != null) {
        sql += EOL + `INNER JOIN courses c ON e.course_id = c.id`;
    }
    if (params?.select == null
        || params.select.lecturer_name
        || where.lecturer_name != null) {
        sql += EOL + `INNER JOIN lecturers l ON e.lecturer_id = l.id`;
    }
    if (params?.select == null
        || params.select.class_room_name
        || where.class_room_name != null) {
        sql += EOL + `INNER JOIN class_rooms cr ON e.class_room_id = cr.id`;
    }
    if (params?.select == null
        || params.select.schedule_day
        || params.select.schedule_start_time
        || params.select.schedule_end_time
        || where.schedule_day != null
        || where.schedule_start_time != null
        || where.schedule_end_time != null) {
        sql += EOL + `INNER JOIN schedules sch ON e.schedule_id = sch.id`;
    }
    if (params?.select == null
        || params.select.grade_id
        || params.select.letter_grade
        || where.grade_id != null
        || where.letter_grade != null) {
        sql += EOL + `LEFT JOIN grades g ON e.id = g.enrollment_id`;
    }
    sql += EOL + `WHERE 1 = 1`;
    params?.where?.forEach(condition => {
        const where = whereCondition(condition);
        if (where?.hasValue) {
            sql += EOL + 'AND ' + where.sql;
            paramsValues.push(...where.values);
        }
    });
    return connection.query({ sql, rowsAsArray: true }, paramsValues)
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectEnrollmentsResult(data, params?.select)));
}

function mapArrayToSelectEnrollmentsResult(data: any, select?: SelectEnrollmentsSelect) {
    const result = {} as SelectEnrollmentsResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.student_id) {
        result.student_id = data[rowIndex++];
    }
    if (select == null || select.course_id) {
        result.course_id = data[rowIndex++];
    }
    if (select == null || select.lecturer_id) {
        result.lecturer_id = data[rowIndex++];
    }
    if (select == null || select.class_room_id) {
        result.class_room_id = data[rowIndex++];
    }
    if (select == null || select.schedule_id) {
        result.schedule_id = data[rowIndex++];
    }
    if (select == null || select.semester) {
        result.semester = data[rowIndex++];
    }
    if (select == null || select.academic_year) {
        result.academic_year = data[rowIndex++];
    }
    if (select == null || select.student_name) {
        result.student_name = data[rowIndex++];
    }
    if (select == null || select.study_program_name) {
        result.study_program_name = data[rowIndex++];
    }
    if (select == null || select.course_name) {
        result.course_name = data[rowIndex++];
    }
    if (select == null || select.course_credits) {
        result.course_credits = data[rowIndex++];
    }
    if (select == null || select.lecturer_name) {
        result.lecturer_name = data[rowIndex++];
    }
    if (select == null || select.class_room_name) {
        result.class_room_name = data[rowIndex++];
    }
    if (select == null || select.schedule_day) {
        result.schedule_day = data[rowIndex++];
    }
    if (select == null || select.schedule_start_time) {
        result.schedule_start_time = data[rowIndex++];
    }
    if (select == null || select.schedule_end_time) {
        result.schedule_end_time = data[rowIndex++];
    }
    if (select == null || select.grade_id) {
        result.grade_id = data[rowIndex++];
    }
    if (select == null || select.letter_grade) {
        result.letter_grade = data[rowIndex++];
    }
    return result;
}

function appendSelect(sql: string, selectField: string) {
    if (sql == 'SELECT') {
        return sql + EOL + selectField;
    }
    else {
        return sql + ', ' + EOL + selectField;
    }
}

function whereConditionsToObject(whereConditions?: SelectEnrollmentsWhere[]) {
    const obj = {} as any;
    whereConditions?.forEach(condition => {
        const where = whereCondition(condition);
        if (where?.hasValue) {
            obj[condition[0]] = true;
        }
    });
    return obj;
}

type WhereConditionResult = {
    sql: string;
    hasValue: boolean;
    values: any[];
}

function whereCondition(condition: SelectEnrollmentsWhere): WhereConditionResult | undefined {

    const selectFragment = selectFragments[condition[0]];
    const operator = condition[1];

    if (operator == 'LIKE') {
        return {
            sql: `${selectFragment} LIKE concat('%', ?, '%')`,
            hasValue: condition[2] != null,
            values: [condition[2]]
        }
    }
    if (operator == 'BETWEEN') {
        return {
            sql: `${selectFragment} BETWEEN ? AND ?`,
            hasValue: condition[2] != null && condition[3] != null,
            values: [condition[2], condition[3]]
        }
    }
    if (operator == 'IN' || operator == 'NOT IN') {
        return {
            sql: `${selectFragment} ${operator} (?)`,
            hasValue: condition[2] != null && condition[2].length > 0,
            values: [condition[2]]
        }
    }
    if (NumericOperatorList.includes(operator)) {
        return {
            sql: `${selectFragment} ${operator} ?`,
            hasValue: condition[2] != null,
            values: [condition[2]]
        }
    }
}