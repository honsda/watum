import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectFacultiesDynamicParams = {
    select?: SelectFacultiesSelect;
    params?: SelectFacultiesParams;
    where?: SelectFacultiesWhere[];
}

export type SelectFacultiesParams = {
    afterId?: string | null;
    limit?: number | null;
}

export type SelectFacultiesResult = {
    id?: string;
    name?: string;
    created_at?: Date;
    updated_at?: Date;
    study_program_count?: number;
}

export type SelectFacultiesSelect = {
    id?: boolean;
    name?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    study_program_count?: boolean;
}

const selectFragments = {
    id: `id`,
    name: `name`,
    created_at: `created_at`,
    updated_at: `updated_at`,
    study_program_count: `(SELECT COUNT(*) from study_programs sp WHERE sp.faculty_id = faculties.id)`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'FULLTEXT';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectFacultiesWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['name', StringOperator, string | null]
    | ['name', SetOperator, string[]]
    | ['name', BetweenOperator, string | null, string | null]
    | ['created_at', NumericOperator, Date | null]
    | ['created_at', SetOperator, Date[]]
    | ['created_at', BetweenOperator, Date | null, Date | null]
    | ['updated_at', NumericOperator, Date | null]
    | ['updated_at', SetOperator, Date[]]
    | ['updated_at', BetweenOperator, Date | null, Date | null]
    | ['study_program_count', NumericOperator, number | null]
    | ['study_program_count', SetOperator, number[]]
    | ['study_program_count', BetweenOperator, number | null, number | null]

export async function selectFaculties(connection: Connection, params?: SelectFacultiesDynamicParams): Promise<SelectFacultiesResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `id`);
    }
    if (params?.select == null || params.select.name) {
        sql = appendSelect(sql, `name`);
    }
    if (params?.select == null || params.select.created_at) {
        sql = appendSelect(sql, `created_at`);
    }
    if (params?.select == null || params.select.updated_at) {
        sql = appendSelect(sql, `updated_at`);
    }
    if (params?.select == null || params.select.study_program_count) {
        sql = appendSelect(sql, `(SELECT COUNT(*) from study_programs sp WHERE sp.faculty_id = faculties.id) AS study_program_count`);
    }
    sql += EOL + `FROM faculties`;
    sql += EOL + `WHERE 1 = 1`;
    params?.where?.forEach(condition => {
        const where = whereCondition(condition);
        if (where?.hasValue) {
            sql += EOL + 'AND ' + where.sql;
            paramsValues.push(...where.values);
        }
    });if (params?.params?.afterId != null) {
        sql += EOL + `AND id > ?`;
        paramsValues.push(params.params.afterId);
    }sql += EOL + `ORDER BY id ASC`;
    if (params?.params?.limit != null) {
        sql += EOL + `LIMIT ?`;
        paramsValues.push(params.params.limit);
    }
    return connection.query({ sql, rowsAsArray: true }, paramsValues)
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFacultiesResult(data, params?.select)));
}

function mapArrayToSelectFacultiesResult(data: any, select?: SelectFacultiesSelect) {
    const result = {} as SelectFacultiesResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.name) {
        result.name = data[rowIndex++];
    }
    if (select == null || select.created_at) {
        result.created_at = data[rowIndex++];
    }
    if (select == null || select.updated_at) {
        result.updated_at = data[rowIndex++];
    }
    if (select == null || select.study_program_count) {
        result.study_program_count = data[rowIndex++];
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

function whereConditionsToObject(whereConditions?: SelectFacultiesWhere[]) {
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

function whereCondition(condition: SelectFacultiesWhere): WhereConditionResult | undefined {

    const selectFragment = selectFragments[condition[0]];
    const operator = condition[1];

    if (operator == 'LIKE') {
        return {
            sql: `${selectFragment} LIKE ?`,
            hasValue: condition[2] != null,
            values: [condition[2]]
        }
    }
    if (operator == 'FULLTEXT') {
        return {
            sql: `MATCH(${selectFragment}) AGAINST(? IN BOOLEAN MODE)`,
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
