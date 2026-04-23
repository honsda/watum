import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectStudentsDynamicParams = {
    select?: SelectStudentsSelect;
    params?: SelectStudentsParams;
    where?: SelectStudentsWhere[];
}

export type SelectStudentsParams = {
    offset?: number | null;
    limit?: number | null;
}

export type SelectStudentsResult = {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    year_admitted?: number;
    study_program_id?: string;
    created_at?: Date;
    updated_at?: Date;
    study_program_name?: string;
    faculty_name?: string;
    faculty_id?: string;
    enrollment_count?: number;
}

export type SelectStudentsSelect = {
    id?: boolean;
    name?: boolean;
    email?: boolean;
    phone?: boolean;
    address?: boolean;
    year_admitted?: boolean;
    study_program_id?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    study_program_name?: boolean;
    faculty_name?: boolean;
    faculty_id?: boolean;
    enrollment_count?: boolean;
}

const selectFragments = {
    id: `s.id`,
    name: `s.name`,
    email: `s.email`,
    phone: `s.phone`,
    address: `s.address`,
    year_admitted: `s.year_admitted`,
    study_program_id: `s.study_program_id`,
    created_at: `s.created_at`,
    updated_at: `s.updated_at`,
    study_program_name: `sp.name`,
    faculty_name: `f.name`,
    faculty_id: `f.id`,
    enrollment_count: `(SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id)`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectStudentsWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['name', StringOperator, string | null]
    | ['name', SetOperator, string[]]
    | ['name', BetweenOperator, string | null, string | null]
    | ['email', StringOperator, string | null]
    | ['email', SetOperator, string[]]
    | ['email', BetweenOperator, string | null, string | null]
    | ['phone', StringOperator, string | null]
    | ['phone', SetOperator, string[]]
    | ['phone', BetweenOperator, string | null, string | null]
    | ['address', StringOperator, string | null]
    | ['address', SetOperator, string[]]
    | ['address', BetweenOperator, string | null, string | null]
    | ['year_admitted', NumericOperator, number | null]
    | ['year_admitted', SetOperator, number[]]
    | ['year_admitted', BetweenOperator, number | null, number | null]
    | ['study_program_id', StringOperator, string | null]
    | ['study_program_id', SetOperator, string[]]
    | ['study_program_id', BetweenOperator, string | null, string | null]
    | ['created_at', NumericOperator, Date | null]
    | ['created_at', SetOperator, Date[]]
    | ['created_at', BetweenOperator, Date | null, Date | null]
    | ['updated_at', NumericOperator, Date | null]
    | ['updated_at', SetOperator, Date[]]
    | ['updated_at', BetweenOperator, Date | null, Date | null]
    | ['study_program_name', StringOperator, string | null]
    | ['study_program_name', SetOperator, string[]]
    | ['study_program_name', BetweenOperator, string | null, string | null]
    | ['faculty_name', StringOperator, string | null]
    | ['faculty_name', SetOperator, string[]]
    | ['faculty_name', BetweenOperator, string | null, string | null]
    | ['faculty_id', StringOperator, string | null]
    | ['faculty_id', SetOperator, string[]]
    | ['faculty_id', BetweenOperator, string | null, string | null]
    | ['enrollment_count', NumericOperator, number | null]
    | ['enrollment_count', SetOperator, number[]]
    | ['enrollment_count', BetweenOperator, number | null, number | null]

export async function selectStudents(connection: Connection, params?: SelectStudentsDynamicParams): Promise<SelectStudentsResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `s.id`);
    }
    if (params?.select == null || params.select.name) {
        sql = appendSelect(sql, `s.name`);
    }
    if (params?.select == null || params.select.email) {
        sql = appendSelect(sql, `s.email`);
    }
    if (params?.select == null || params.select.phone) {
        sql = appendSelect(sql, `s.phone`);
    }
    if (params?.select == null || params.select.address) {
        sql = appendSelect(sql, `s.address`);
    }
    if (params?.select == null || params.select.year_admitted) {
        sql = appendSelect(sql, `s.year_admitted`);
    }
    if (params?.select == null || params.select.study_program_id) {
        sql = appendSelect(sql, `s.study_program_id`);
    }
    if (params?.select == null || params.select.created_at) {
        sql = appendSelect(sql, `s.created_at`);
    }
    if (params?.select == null || params.select.updated_at) {
        sql = appendSelect(sql, `s.updated_at`);
    }
    if (params?.select == null || params.select.study_program_name) {
        sql = appendSelect(sql, `sp.name AS study_program_name`);
    }
    if (params?.select == null || params.select.faculty_name) {
        sql = appendSelect(sql, `f.name AS faculty_name`);
    }
    if (params?.select == null || params.select.faculty_id) {
        sql = appendSelect(sql, `f.id AS faculty_id`);
    }
    if (params?.select == null || params.select.enrollment_count) {
        sql = appendSelect(sql, `(SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id) AS enrollment_count`);
    }
    sql += EOL + `FROM students s`;
    if (params?.select == null
        || params.select.study_program_name
        || params.select.faculty_name
        || params.select.faculty_id
        || where.study_program_name != null
        || where.faculty_name != null
        || where.faculty_id != null) {
        sql += EOL + `INNER JOIN study_programs sp ON s.study_program_id = sp.id`;
    }
    if (params?.select == null
        || params.select.faculty_name
        || params.select.faculty_id
        || where.faculty_name != null
        || where.faculty_id != null) {
        sql += EOL + `INNER JOIN faculties f ON sp.faculty_id = f.id`;
    }
    sql += EOL + `WHERE 1 = 1`;
    params?.where?.forEach(condition => {
        const where = whereCondition(condition);
        if (where?.hasValue) {
            sql += EOL + 'AND ' + where.sql;
            paramsValues.push(...where.values);
        }
    });if (params?.params?.offset != null && params?.params?.limit != null) {
        sql += EOL + `LIMIT ?, ?`;
        paramsValues.push(params.params.offset);
        paramsValues.push(params.params.limit);
    }
    return connection.query({ sql, rowsAsArray: true }, paramsValues)
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectStudentsResult(data, params?.select)));
}

function mapArrayToSelectStudentsResult(data: any, select?: SelectStudentsSelect) {
    const result = {} as SelectStudentsResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.name) {
        result.name = data[rowIndex++];
    }
    if (select == null || select.email) {
        result.email = data[rowIndex++];
    }
    if (select == null || select.phone) {
        result.phone = data[rowIndex++];
    }
    if (select == null || select.address) {
        result.address = data[rowIndex++];
    }
    if (select == null || select.year_admitted) {
        result.year_admitted = data[rowIndex++];
    }
    if (select == null || select.study_program_id) {
        result.study_program_id = data[rowIndex++];
    }
    if (select == null || select.created_at) {
        result.created_at = data[rowIndex++];
    }
    if (select == null || select.updated_at) {
        result.updated_at = data[rowIndex++];
    }
    if (select == null || select.study_program_name) {
        result.study_program_name = data[rowIndex++];
    }
    if (select == null || select.faculty_name) {
        result.faculty_name = data[rowIndex++];
    }
    if (select == null || select.faculty_id) {
        result.faculty_id = data[rowIndex++];
    }
    if (select == null || select.enrollment_count) {
        result.enrollment_count = data[rowIndex++];
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

function whereConditionsToObject(whereConditions?: SelectStudentsWhere[]) {
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

function whereCondition(condition: SelectStudentsWhere): WhereConditionResult | undefined {

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