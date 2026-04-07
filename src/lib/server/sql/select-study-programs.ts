import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectStudyProgramsDynamicParams = {
    select?: SelectStudyProgramsSelect;
    where?: SelectStudyProgramsWhere[];
}

export type SelectStudyProgramsResult = {
    id?: string;
    name?: string;
    head?: string;
    faculty_id?: string;
    faculty_name?: string;
    created_at?: Date;
    updated_at?: Date;
    student_count?: number;
}

export type SelectStudyProgramsSelect = {
    id?: boolean;
    name?: boolean;
    head?: boolean;
    faculty_id?: boolean;
    faculty_name?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    student_count?: boolean;
}

const selectFragments = {
    id: `sp.id`,
    name: `sp.name`,
    head: `sp.head`,
    faculty_id: `sp.faculty_id`,
    faculty_name: `f.name`,
    created_at: `sp.created_at`,
    updated_at: `sp.updated_at`,
    student_count: `(SELECT COUNT(*) FROM students s WHERE s.study_program_id = sp.id)`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectStudyProgramsWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['name', StringOperator, string | null]
    | ['name', SetOperator, string[]]
    | ['name', BetweenOperator, string | null, string | null]
    | ['head', StringOperator, string | null]
    | ['head', SetOperator, string[]]
    | ['head', BetweenOperator, string | null, string | null]
    | ['faculty_id', StringOperator, string | null]
    | ['faculty_id', SetOperator, string[]]
    | ['faculty_id', BetweenOperator, string | null, string | null]
    | ['faculty_name', StringOperator, string | null]
    | ['faculty_name', SetOperator, string[]]
    | ['faculty_name', BetweenOperator, string | null, string | null]
    | ['created_at', NumericOperator, Date | null]
    | ['created_at', SetOperator, Date[]]
    | ['created_at', BetweenOperator, Date | null, Date | null]
    | ['updated_at', NumericOperator, Date | null]
    | ['updated_at', SetOperator, Date[]]
    | ['updated_at', BetweenOperator, Date | null, Date | null]
    | ['student_count', NumericOperator, number | null]
    | ['student_count', SetOperator, number[]]
    | ['student_count', BetweenOperator, number | null, number | null]

export async function selectStudyPrograms(connection: Connection, params?: SelectStudyProgramsDynamicParams): Promise<SelectStudyProgramsResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `sp.id`);
    }
    if (params?.select == null || params.select.name) {
        sql = appendSelect(sql, `sp.name`);
    }
    if (params?.select == null || params.select.head) {
        sql = appendSelect(sql, `sp.head`);
    }
    if (params?.select == null || params.select.faculty_id) {
        sql = appendSelect(sql, `sp.faculty_id`);
    }
    if (params?.select == null || params.select.faculty_name) {
        sql = appendSelect(sql, `f.name AS faculty_name`);
    }
    if (params?.select == null || params.select.created_at) {
        sql = appendSelect(sql, `sp.created_at`);
    }
    if (params?.select == null || params.select.updated_at) {
        sql = appendSelect(sql, `sp.updated_at`);
    }
    if (params?.select == null || params.select.student_count) {
        sql = appendSelect(sql, `(SELECT COUNT(*) FROM students s WHERE s.study_program_id = sp.id) AS student_count`);
    }
    sql += EOL + `FROM study_programs sp`;
    if (params?.select == null
        || params.select.faculty_name
        || where.faculty_name != null) {
        sql += EOL + `INNER JOIN faculties f ON sp.faculty_id = f.id`;
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
        .then(res => res.map(data => mapArrayToSelectStudyProgramsResult(data, params?.select)));
}

function mapArrayToSelectStudyProgramsResult(data: any, select?: SelectStudyProgramsSelect) {
    const result = {} as SelectStudyProgramsResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.name) {
        result.name = data[rowIndex++];
    }
    if (select == null || select.head) {
        result.head = data[rowIndex++];
    }
    if (select == null || select.faculty_id) {
        result.faculty_id = data[rowIndex++];
    }
    if (select == null || select.faculty_name) {
        result.faculty_name = data[rowIndex++];
    }
    if (select == null || select.created_at) {
        result.created_at = data[rowIndex++];
    }
    if (select == null || select.updated_at) {
        result.updated_at = data[rowIndex++];
    }
    if (select == null || select.student_count) {
        result.student_count = data[rowIndex++];
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

function whereConditionsToObject(whereConditions?: SelectStudyProgramsWhere[]) {
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

function whereCondition(condition: SelectStudyProgramsWhere): WhereConditionResult | undefined {

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