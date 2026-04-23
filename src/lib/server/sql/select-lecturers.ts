import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectLecturersDynamicParams = {
    select?: SelectLecturersSelect;
    params?: SelectLecturersParams;
    where?: SelectLecturersWhere[];
}

export type SelectLecturersParams = {
    offset?: number | null;
    limit?: number | null;
}

export type SelectLecturersResult = {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    created_at?: Date;
    updated_at?: Date;
    schedule_count?: number;
}

export type SelectLecturersSelect = {
    id?: boolean;
    name?: boolean;
    email?: boolean;
    phone?: boolean;
    address?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    schedule_count?: boolean;
}

const selectFragments = {
    id: `id`,
    name: `name`,
    email: `email`,
    phone: `phone`,
    address: `address`,
    created_at: `created_at`,
    updated_at: `updated_at`,
    schedule_count: `(SELECT COUNT(*) FROM schedules s WHERE s.lecturer_id = lecturers.id)`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectLecturersWhere =
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
    | ['created_at', NumericOperator, Date | null]
    | ['created_at', SetOperator, Date[]]
    | ['created_at', BetweenOperator, Date | null, Date | null]
    | ['updated_at', NumericOperator, Date | null]
    | ['updated_at', SetOperator, Date[]]
    | ['updated_at', BetweenOperator, Date | null, Date | null]
    | ['schedule_count', NumericOperator, number | null]
    | ['schedule_count', SetOperator, number[]]
    | ['schedule_count', BetweenOperator, number | null, number | null]

export async function selectLecturers(connection: Connection, params?: SelectLecturersDynamicParams): Promise<SelectLecturersResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `id`);
    }
    if (params?.select == null || params.select.name) {
        sql = appendSelect(sql, `name`);
    }
    if (params?.select == null || params.select.email) {
        sql = appendSelect(sql, `email`);
    }
    if (params?.select == null || params.select.phone) {
        sql = appendSelect(sql, `phone`);
    }
    if (params?.select == null || params.select.address) {
        sql = appendSelect(sql, `address`);
    }
    if (params?.select == null || params.select.created_at) {
        sql = appendSelect(sql, `created_at`);
    }
    if (params?.select == null || params.select.updated_at) {
        sql = appendSelect(sql, `updated_at`);
    }
    if (params?.select == null || params.select.schedule_count) {
        sql = appendSelect(sql, `(SELECT COUNT(*) FROM schedules s WHERE s.lecturer_id = lecturers.id) AS schedule_count`);
    }
    sql += EOL + `FROM lecturers`;
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
        .then(res => res.map(data => mapArrayToSelectLecturersResult(data, params?.select)));
}

function mapArrayToSelectLecturersResult(data: any, select?: SelectLecturersSelect) {
    const result = {} as SelectLecturersResult;
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
    if (select == null || select.created_at) {
        result.created_at = data[rowIndex++];
    }
    if (select == null || select.updated_at) {
        result.updated_at = data[rowIndex++];
    }
    if (select == null || select.schedule_count) {
        result.schedule_count = data[rowIndex++];
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

function whereConditionsToObject(whereConditions?: SelectLecturersWhere[]) {
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

function whereCondition(condition: SelectLecturersWhere): WhereConditionResult | undefined {

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