import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectSchedulesDynamicParams = {
    select?: SelectSchedulesSelect;
    params?: SelectSchedulesParams;
    where?: SelectSchedulesWhere[];
}

export type SelectSchedulesParams = {
    offset?: number | null;
    limit?: number | null;
}

export type SelectSchedulesResult = {
    id?: string;
    class_room_id?: string;
    day?: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    start_time?: string;
    end_time?: string;
    lecturer_id?: string;
    course_name?: string;
}

export type SelectSchedulesSelect = {
    id?: boolean;
    class_room_id?: boolean;
    day?: boolean;
    start_time?: boolean;
    end_time?: boolean;
    lecturer_id?: boolean;
    course_name?: boolean;
}

const selectFragments = {
    id: `s.id`,
    class_room_id: `s.class_room_id`,
    day: `s.day`,
    start_time: `s.start_time`,
    end_time: `s.end_time`,
    lecturer_id: `s.lecturer_id`,
    course_name: `c.name`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'FULLTEXT';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectSchedulesWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['class_room_id', StringOperator, string | null]
    | ['class_room_id', SetOperator, string[]]
    | ['class_room_id', BetweenOperator, string | null, string | null]
    | ['day', StringOperator, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | null]
    | ['day', SetOperator, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU'[]]
    | ['day', BetweenOperator, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | null, 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | null]
    | ['start_time', StringOperator, string | null]
    | ['start_time', SetOperator, string[]]
    | ['start_time', BetweenOperator, string | null, string | null]
    | ['end_time', StringOperator, string | null]
    | ['end_time', SetOperator, string[]]
    | ['end_time', BetweenOperator, string | null, string | null]
    | ['lecturer_id', StringOperator, string | null]
    | ['lecturer_id', SetOperator, string[]]
    | ['lecturer_id', BetweenOperator, string | null, string | null]
    | ['course_name', StringOperator, string | null]
    | ['course_name', SetOperator, string[]]
    | ['course_name', BetweenOperator, string | null, string | null]

export async function selectSchedules(connection: Connection, params?: SelectSchedulesDynamicParams): Promise<SelectSchedulesResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `s.id`);
    }
    if (params?.select == null || params.select.class_room_id) {
        sql = appendSelect(sql, `s.class_room_id`);
    }
    if (params?.select == null || params.select.day) {
        sql = appendSelect(sql, `s.day`);
    }
    if (params?.select == null || params.select.start_time) {
        sql = appendSelect(sql, `s.start_time`);
    }
    if (params?.select == null || params.select.end_time) {
        sql = appendSelect(sql, `s.end_time`);
    }
    if (params?.select == null || params.select.lecturer_id) {
        sql = appendSelect(sql, `s.lecturer_id`);
    }
    if (params?.select == null || params.select.course_name) {
        sql = appendSelect(sql, `c.name AS course_name`);
    }
    sql += EOL + `FROM schedules s`;
    if (params?.select == null
        || params.select.course_name
        || where.course_name != null) {
        sql += EOL + `LEFT JOIN enrollments e ON s.id = e.schedule_id`;
    }
    if (params?.select == null
        || params.select.course_name
        || where.course_name != null) {
        sql += EOL + `LEFT JOIN courses c ON e.course_id = c.id`;
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
        .then(res => res.map(data => mapArrayToSelectSchedulesResult(data, params?.select)));
}

function mapArrayToSelectSchedulesResult(data: any, select?: SelectSchedulesSelect) {
    const result = {} as SelectSchedulesResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.class_room_id) {
        result.class_room_id = data[rowIndex++];
    }
    if (select == null || select.day) {
        result.day = data[rowIndex++];
    }
    if (select == null || select.start_time) {
        result.start_time = data[rowIndex++];
    }
    if (select == null || select.end_time) {
        result.end_time = data[rowIndex++];
    }
    if (select == null || select.lecturer_id) {
        result.lecturer_id = data[rowIndex++];
    }
    if (select == null || select.course_name) {
        result.course_name = data[rowIndex++];
    }
    return result;
}

function appendSelect(sql: string, selectField: string) {
    if (!/[\r\n]/.test(sql)) {
        return sql + EOL + selectField;
    }
    else {
        return sql + ', ' + EOL + selectField;
    }
}

function whereConditionsToObject(whereConditions?: SelectSchedulesWhere[]) {
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

function whereCondition(condition: SelectSchedulesWhere): WhereConditionResult | undefined {

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
