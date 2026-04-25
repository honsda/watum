import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectCoursesDynamicParams = {
    select?: SelectCoursesSelect;
    params?: SelectCoursesParams;
    where?: SelectCoursesWhere[];
}

export type SelectCoursesParams = {
    afterId?: string | null;
    limit?: number | null;
}

export type SelectCoursesResult = {
    id?: string;
    name?: string;
    credits?: number;
    study_program_id?: string;
    lecturer_id?: string;
    lecturer_name?: string;
    study_program_name?: string;
    created_at?: Date;
    updated_at?: Date;
    enrollment_count?: number;
}

export type SelectCoursesSelect = {
    id?: boolean;
    name?: boolean;
    credits?: boolean;
    study_program_id?: boolean;
    lecturer_id?: boolean;
    lecturer_name?: boolean;
    study_program_name?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    enrollment_count?: boolean;
}

const selectFragments = {
    id: `c.id`,
    name: `c.name`,
    credits: `c.credits`,
    study_program_id: `c.study_program_id`,
    lecturer_id: `c.lecturer_id`,
    lecturer_name: `l.name`,
    study_program_name: `sp.name`,
    created_at: `c.created_at`,
    updated_at: `c.updated_at`,
    enrollment_count: `(SELECT COUNT(*) from enrollments e WHERE e.course_id = c.id)`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectCoursesWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['name', StringOperator, string | null]
    | ['name', SetOperator, string[]]
    | ['name', BetweenOperator, string | null, string | null]
    | ['credits', NumericOperator, number | null]
    | ['credits', SetOperator, number[]]
    | ['credits', BetweenOperator, number | null, number | null]
    | ['study_program_id', StringOperator, string | null]
    | ['study_program_id', SetOperator, string[]]
    | ['study_program_id', BetweenOperator, string | null, string | null]
    | ['lecturer_id', StringOperator, string | null]
    | ['lecturer_id', SetOperator, string[]]
    | ['lecturer_id', BetweenOperator, string | null, string | null]
    | ['lecturer_name', StringOperator, string | null]
    | ['lecturer_name', SetOperator, string[]]
    | ['lecturer_name', BetweenOperator, string | null, string | null]
    | ['study_program_name', StringOperator, string | null]
    | ['study_program_name', SetOperator, string[]]
    | ['study_program_name', BetweenOperator, string | null, string | null]
    | ['created_at', NumericOperator, Date | null]
    | ['created_at', SetOperator, Date[]]
    | ['created_at', BetweenOperator, Date | null, Date | null]
    | ['updated_at', NumericOperator, Date | null]
    | ['updated_at', SetOperator, Date[]]
    | ['updated_at', BetweenOperator, Date | null, Date | null]
    | ['enrollment_count', NumericOperator, number | null]
    | ['enrollment_count', SetOperator, number[]]
    | ['enrollment_count', BetweenOperator, number | null, number | null]

export async function selectCourses(connection: Connection, params?: SelectCoursesDynamicParams): Promise<SelectCoursesResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    // MANUAL FIX: STRAIGHT_JOIN forces MariaDB to read courses first and
    // then do eq_ref lookups into joined tables. Without this, the optimizer
    // can choose study_programs (very small table) as the driving table and
    // BNL join into courses, causing suboptimal plans.
    // If you regenerate this file with typesql, you must re-apply this change.
    let sql = 'SELECT STRAIGHT_JOIN';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `c.id`);
    }
    if (params?.select == null || params.select.name) {
        sql = appendSelect(sql, `c.name`);
    }
    if (params?.select == null || params.select.credits) {
        sql = appendSelect(sql, `c.credits`);
    }
    if (params?.select == null || params.select.study_program_id) {
        sql = appendSelect(sql, `c.study_program_id`);
    }
    if (params?.select == null || params.select.lecturer_id) {
        sql = appendSelect(sql, `c.lecturer_id`);
    }
    if (params?.select == null || params.select.lecturer_name) {
        sql = appendSelect(sql, `l.name AS lecturer_name`);
    }
    if (params?.select == null || params.select.study_program_name) {
        sql = appendSelect(sql, `sp.name AS study_program_name`);
    }
    if (params?.select == null || params.select.created_at) {
        sql = appendSelect(sql, `c.created_at`);
    }
    if (params?.select == null || params.select.updated_at) {
        sql = appendSelect(sql, `c.updated_at`);
    }
    if (params?.select == null || params.select.enrollment_count) {
        sql = appendSelect(sql, `(SELECT COUNT(*) from enrollments e WHERE e.course_id = c.id) AS enrollment_count`);
    }
    sql += EOL + `FROM courses c`;
    if (params?.select == null
        || params.select.study_program_name
        || where.study_program_name != null) {
        sql += EOL + `INNER JOIN study_programs sp ON c.study_program_id = sp.id`;
    }
    if (params?.select == null
        || params.select.lecturer_name
        || where.lecturer_name != null) {
        sql += EOL + `INNER JOIN lecturers l ON c.lecturer_id = l.id`;
    }
    sql += EOL + `WHERE 1 = 1`;
    params?.where?.forEach(condition => {
        const where = whereCondition(condition);
        if (where?.hasValue) {
            sql += EOL + 'AND ' + where.sql;
            paramsValues.push(...where.values);
        }
    });if (params?.params?.afterId != null) {
        sql += EOL + `AND c.id > ?`;
        paramsValues.push(params.params.afterId);
    }sql += EOL + `ORDER BY c.id ASC`;
    if (params?.params?.limit != null) {
        sql += EOL + `LIMIT ?`;
        paramsValues.push(params.params.limit);
    }
    return connection.query({ sql, rowsAsArray: true }, paramsValues)
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectCoursesResult(data, params?.select)));
}

function mapArrayToSelectCoursesResult(data: any, select?: SelectCoursesSelect) {
    const result = {} as SelectCoursesResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.name) {
        result.name = data[rowIndex++];
    }
    if (select == null || select.credits) {
        result.credits = data[rowIndex++];
    }
    if (select == null || select.study_program_id) {
        result.study_program_id = data[rowIndex++];
    }
    if (select == null || select.lecturer_id) {
        result.lecturer_id = data[rowIndex++];
    }
    if (select == null || select.lecturer_name) {
        result.lecturer_name = data[rowIndex++];
    }
    if (select == null || select.study_program_name) {
        result.study_program_name = data[rowIndex++];
    }
    if (select == null || select.created_at) {
        result.created_at = data[rowIndex++];
    }
    if (select == null || select.updated_at) {
        result.updated_at = data[rowIndex++];
    }
    if (select == null || select.enrollment_count) {
        result.enrollment_count = data[rowIndex++];
    }
    return result;
}

function appendSelect(sql: string, selectField: string) {
    if (!sql.includes(',')) {
        return sql + EOL + selectField;
    }
    else {
        return sql + ', ' + EOL + selectField;
    }
}

function whereConditionsToObject(whereConditions?: SelectCoursesWhere[]) {
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

function whereCondition(condition: SelectCoursesWhere): WhereConditionResult | undefined {

    const selectFragment = selectFragments[condition[0]];
    const operator = condition[1];

    if (operator == 'LIKE') {
        return {
            sql: `${selectFragment} LIKE ?`,
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
