import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectClassRoomsDynamicParams = {
    select?: SelectClassRoomsSelect;
    params?: SelectClassRoomsParams;
    where?: SelectClassRoomsWhere[];
}

export type SelectClassRoomsParams = {
    offset?: number | null;
    limit?: number | null;
}

export type SelectClassRoomsResult = {
    id?: string;
    name?: string;
    class_room_type?: 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM';
    capacity?: number;
    has_projector?: number;
    has_ac?: number;
    created_at?: Date;
    updated_at?: Date;
    enrollment_count?: number;
    schedule_count?: number;
}

export type SelectClassRoomsSelect = {
    id?: boolean;
    name?: boolean;
    class_room_type?: boolean;
    capacity?: boolean;
    has_projector?: boolean;
    has_ac?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    enrollment_count?: boolean;
    schedule_count?: boolean;
}

const selectFragments = {
    id: `c.id`,
    name: `c.name`,
    class_room_type: `c.class_room_type`,
    capacity: `c.capacity`,
    has_projector: `c.has_projector`,
    has_ac: `c.has_ac`,
    created_at: `c.created_at`,
    updated_at: `c.updated_at`,
    enrollment_count: `(SELECT COUNT(*) FROM enrollments e WHERE e.class_room_id = c.id)`,
    schedule_count: `(SELECT COUNT(*) FROM schedules s WHERE s.class_room_id = c.id)`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectClassRoomsWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['name', StringOperator, string | null]
    | ['name', SetOperator, string[]]
    | ['name', BetweenOperator, string | null, string | null]
    | ['class_room_type', StringOperator, 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM' | null]
    | ['class_room_type', SetOperator, 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM'[]]
    | ['class_room_type', BetweenOperator, 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM' | null, 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM' | null]
    | ['capacity', NumericOperator, number | null]
    | ['capacity', SetOperator, number[]]
    | ['capacity', BetweenOperator, number | null, number | null]
    | ['has_projector', NumericOperator, number | null]
    | ['has_projector', SetOperator, number[]]
    | ['has_projector', BetweenOperator, number | null, number | null]
    | ['has_ac', NumericOperator, number | null]
    | ['has_ac', SetOperator, number[]]
    | ['has_ac', BetweenOperator, number | null, number | null]
    | ['created_at', NumericOperator, Date | null]
    | ['created_at', SetOperator, Date[]]
    | ['created_at', BetweenOperator, Date | null, Date | null]
    | ['updated_at', NumericOperator, Date | null]
    | ['updated_at', SetOperator, Date[]]
    | ['updated_at', BetweenOperator, Date | null, Date | null]
    | ['enrollment_count', NumericOperator, number | null]
    | ['enrollment_count', SetOperator, number[]]
    | ['enrollment_count', BetweenOperator, number | null, number | null]
    | ['schedule_count', NumericOperator, number | null]
    | ['schedule_count', SetOperator, number[]]
    | ['schedule_count', BetweenOperator, number | null, number | null]

export async function selectClassRooms(connection: Connection, params?: SelectClassRoomsDynamicParams): Promise<SelectClassRoomsResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `c.id`);
    }
    if (params?.select == null || params.select.name) {
        sql = appendSelect(sql, `c.name`);
    }
    if (params?.select == null || params.select.class_room_type) {
        sql = appendSelect(sql, `c.class_room_type`);
    }
    if (params?.select == null || params.select.capacity) {
        sql = appendSelect(sql, `c.capacity`);
    }
    if (params?.select == null || params.select.has_projector) {
        sql = appendSelect(sql, `c.has_projector`);
    }
    if (params?.select == null || params.select.has_ac) {
        sql = appendSelect(sql, `c.has_ac`);
    }
    if (params?.select == null || params.select.created_at) {
        sql = appendSelect(sql, `c.created_at`);
    }
    if (params?.select == null || params.select.updated_at) {
        sql = appendSelect(sql, `c.updated_at`);
    }
    if (params?.select == null || params.select.enrollment_count) {
        sql = appendSelect(sql, `(SELECT COUNT(*) FROM enrollments e WHERE e.class_room_id = c.id) as enrollment_count`);
    }
    if (params?.select == null || params.select.schedule_count) {
        sql = appendSelect(sql, `(SELECT COUNT(*) FROM schedules s WHERE s.class_room_id = c.id) as schedule_count`);
    }
    sql += EOL + `FROM class_rooms c`;
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
        .then(res => res.map(data => mapArrayToSelectClassRoomsResult(data, params?.select)));
}

function mapArrayToSelectClassRoomsResult(data: any, select?: SelectClassRoomsSelect) {
    const result = {} as SelectClassRoomsResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.name) {
        result.name = data[rowIndex++];
    }
    if (select == null || select.class_room_type) {
        result.class_room_type = data[rowIndex++];
    }
    if (select == null || select.capacity) {
        result.capacity = data[rowIndex++];
    }
    if (select == null || select.has_projector) {
        result.has_projector = data[rowIndex++];
    }
    if (select == null || select.has_ac) {
        result.has_ac = data[rowIndex++];
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

function whereConditionsToObject(whereConditions?: SelectClassRoomsWhere[]) {
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

function whereCondition(condition: SelectClassRoomsWhere): WhereConditionResult | undefined {

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