import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectUsersDynamicParams = {
    select?: SelectUsersSelect;
    where?: SelectUsersWhere[];
}

export type SelectUsersResult = {
    id?: string;
    email?: string;
    role?: 'ADMIN' | 'STUDENT' | 'LECTURER';
    password?: string;
    student_id?: string;
    student_name?: string;
    lecturer_id?: string;
    lecturer_name?: string;
}

export type SelectUsersSelect = {
    id?: boolean;
    email?: boolean;
    role?: boolean;
    password?: boolean;
    student_id?: boolean;
    student_name?: boolean;
    lecturer_id?: boolean;
    lecturer_name?: boolean;
}

const selectFragments = {
    id: `u.id`,
    email: `u.email`,
    role: `u.role`,
    password: `u.password`,
    student_id: `u.student_id`,
    student_name: `s.name`,
    lecturer_id: `u.lecturer_id`,
    lecturer_name: `l.name`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectUsersWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['email', StringOperator, string | null]
    | ['email', SetOperator, string[]]
    | ['email', BetweenOperator, string | null, string | null]
    | ['role', StringOperator, 'ADMIN' | 'STUDENT' | 'LECTURER' | null]
    | ['role', SetOperator, 'ADMIN' | 'STUDENT' | 'LECTURER'[]]
    | ['role', BetweenOperator, 'ADMIN' | 'STUDENT' | 'LECTURER' | null, 'ADMIN' | 'STUDENT' | 'LECTURER' | null]
    | ['password', StringOperator, string | null]
    | ['password', SetOperator, string[]]
    | ['password', BetweenOperator, string | null, string | null]
    | ['student_id', StringOperator, string | null]
    | ['student_id', SetOperator, string[]]
    | ['student_id', BetweenOperator, string | null, string | null]
    | ['student_name', StringOperator, string | null]
    | ['student_name', SetOperator, string[]]
    | ['student_name', BetweenOperator, string | null, string | null]
    | ['lecturer_id', StringOperator, string | null]
    | ['lecturer_id', SetOperator, string[]]
    | ['lecturer_id', BetweenOperator, string | null, string | null]
    | ['lecturer_name', StringOperator, string | null]
    | ['lecturer_name', SetOperator, string[]]
    | ['lecturer_name', BetweenOperator, string | null, string | null]

export async function selectUsers(connection: Connection, params?: SelectUsersDynamicParams): Promise<SelectUsersResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `u.id`);
    }
    if (params?.select == null || params.select.email) {
        sql = appendSelect(sql, `u.email`);
    }
    if (params?.select == null || params.select.role) {
        sql = appendSelect(sql, `u.role`);
    }
    if (params?.select == null || params.select.password) {
        sql = appendSelect(sql, `u.password`);
    }
    if (params?.select == null || params.select.student_id) {
        sql = appendSelect(sql, `u.student_id`);
    }
    if (params?.select == null || params.select.student_name) {
        sql = appendSelect(sql, `s.name as student_name`);
    }
    if (params?.select == null || params.select.lecturer_id) {
        sql = appendSelect(sql, `u.lecturer_id`);
    }
    if (params?.select == null || params.select.lecturer_name) {
        sql = appendSelect(sql, `l.name as lecturer_name`);
    }
    sql += EOL + `FROM users u`;
    if (params?.select == null
        || params.select.student_name
        || where.student_name != null) {
        sql += EOL + `LEFT JOIN students s ON u.student_id = s.id`;
    }
    if (params?.select == null
        || params.select.lecturer_name
        || where.lecturer_name != null) {
        sql += EOL + `LEFT JOIN lecturers l ON u.lecturer_id = l.id`;
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
        .then(res => res.map(data => mapArrayToSelectUsersResult(data, params?.select)));
}

function mapArrayToSelectUsersResult(data: any, select?: SelectUsersSelect) {
    const result = {} as SelectUsersResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.email) {
        result.email = data[rowIndex++];
    }
    if (select == null || select.role) {
        result.role = data[rowIndex++];
    }
    if (select == null || select.password) {
        result.password = data[rowIndex++];
    }
    if (select == null || select.student_id) {
        result.student_id = data[rowIndex++];
    }
    if (select == null || select.student_name) {
        result.student_name = data[rowIndex++];
    }
    if (select == null || select.lecturer_id) {
        result.lecturer_id = data[rowIndex++];
    }
    if (select == null || select.lecturer_name) {
        result.lecturer_name = data[rowIndex++];
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

function whereConditionsToObject(whereConditions?: SelectUsersWhere[]) {
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

function whereCondition(condition: SelectUsersWhere): WhereConditionResult | undefined {

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