import type { Connection } from 'mysql2/promise';
import { EOL } from 'os';

export type SelectGradesDynamicParams = {
    select?: SelectGradesSelect;
    where?: SelectGradesWhere[];
}

export type SelectGradesResult = {
    id?: string;
    enrollment_id?: string;
    assignment_score?: number;
    midterm_score?: number;
    final_score?: number;
    total_score?: number;
    letter_grade?: string;
    created_at?: Date;
    updated_at?: Date;
    student_id?: string;
    student_name?: string;
    student_email?: string;
    study_program_name?: string;
    course_id?: string;
    course_name?: string;
    credits?: number;
    lecturer_id?: string;
}

export type SelectGradesSelect = {
    id?: boolean;
    enrollment_id?: boolean;
    assignment_score?: boolean;
    midterm_score?: boolean;
    final_score?: boolean;
    total_score?: boolean;
    letter_grade?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    student_id?: boolean;
    student_name?: boolean;
    student_email?: boolean;
    study_program_name?: boolean;
    course_id?: boolean;
    course_name?: boolean;
    credits?: boolean;
    lecturer_id?: boolean;
}

const selectFragments = {
    id: `g.id`,
    enrollment_id: `g.enrollment_id`,
    assignment_score: `g.assignment_score`,
    midterm_score: `g.midterm_score`,
    final_score: `g.final_score`,
    total_score: `g.total_score`,
    letter_grade: `g.letter_grade`,
    created_at: `g.created_at`,
    updated_at: `g.updated_at`,
    student_id: `s.id`,
    student_name: `s.name`,
    student_email: `s.email`,
    study_program_name: `sp.name`,
    course_id: `c.id`,
    course_name: `c.name`,
    credits: `c.credits`,
    lecturer_id: `e.lecturer_id`,
} as const;

const NumericOperatorList = ['=', '<>', '>', '<', '>=', '<='] as const;
type NumericOperator = typeof NumericOperatorList[number];
type StringOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE';
type SetOperator = 'IN' | 'NOT IN';
type BetweenOperator = 'BETWEEN';

export type SelectGradesWhere =
    | ['id', StringOperator, string | null]
    | ['id', SetOperator, string[]]
    | ['id', BetweenOperator, string | null, string | null]
    | ['enrollment_id', StringOperator, string | null]
    | ['enrollment_id', SetOperator, string[]]
    | ['enrollment_id', BetweenOperator, string | null, string | null]
    | ['assignment_score', NumericOperator, number | null]
    | ['assignment_score', SetOperator, number[]]
    | ['assignment_score', BetweenOperator, number | null, number | null]
    | ['midterm_score', NumericOperator, number | null]
    | ['midterm_score', SetOperator, number[]]
    | ['midterm_score', BetweenOperator, number | null, number | null]
    | ['final_score', NumericOperator, number | null]
    | ['final_score', SetOperator, number[]]
    | ['final_score', BetweenOperator, number | null, number | null]
    | ['total_score', NumericOperator, number | null]
    | ['total_score', SetOperator, number[]]
    | ['total_score', BetweenOperator, number | null, number | null]
    | ['letter_grade', StringOperator, string | null]
    | ['letter_grade', SetOperator, string[]]
    | ['letter_grade', BetweenOperator, string | null, string | null]
    | ['created_at', NumericOperator, Date | null]
    | ['created_at', SetOperator, Date[]]
    | ['created_at', BetweenOperator, Date | null, Date | null]
    | ['updated_at', NumericOperator, Date | null]
    | ['updated_at', SetOperator, Date[]]
    | ['updated_at', BetweenOperator, Date | null, Date | null]
    | ['student_id', StringOperator, string | null]
    | ['student_id', SetOperator, string[]]
    | ['student_id', BetweenOperator, string | null, string | null]
    | ['student_name', StringOperator, string | null]
    | ['student_name', SetOperator, string[]]
    | ['student_name', BetweenOperator, string | null, string | null]
    | ['student_email', StringOperator, string | null]
    | ['student_email', SetOperator, string[]]
    | ['student_email', BetweenOperator, string | null, string | null]
    | ['study_program_name', StringOperator, string | null]
    | ['study_program_name', SetOperator, string[]]
    | ['study_program_name', BetweenOperator, string | null, string | null]
    | ['course_id', StringOperator, string | null]
    | ['course_id', SetOperator, string[]]
    | ['course_id', BetweenOperator, string | null, string | null]
    | ['course_name', StringOperator, string | null]
    | ['course_name', SetOperator, string[]]
    | ['course_name', BetweenOperator, string | null, string | null]
    | ['credits', NumericOperator, number | null]
    | ['credits', SetOperator, number[]]
    | ['credits', BetweenOperator, number | null, number | null]
    | ['lecturer_id', StringOperator, string | null]
    | ['lecturer_id', SetOperator, string[]]
    | ['lecturer_id', BetweenOperator, string | null, string | null]

export async function selectGrades(connection: Connection, params?: SelectGradesDynamicParams): Promise<SelectGradesResult[]> {
    const where = whereConditionsToObject(params?.where);
    const paramsValues: any = [];
    let sql = 'SELECT';
    if (params?.select == null || params.select.id) {
        sql = appendSelect(sql, `g.id`);
    }
    if (params?.select == null || params.select.enrollment_id) {
        sql = appendSelect(sql, `g.enrollment_id`);
    }
    if (params?.select == null || params.select.assignment_score) {
        sql = appendSelect(sql, `g.assignment_score`);
    }
    if (params?.select == null || params.select.midterm_score) {
        sql = appendSelect(sql, `g.midterm_score`);
    }
    if (params?.select == null || params.select.final_score) {
        sql = appendSelect(sql, `g.final_score`);
    }
    if (params?.select == null || params.select.total_score) {
        sql = appendSelect(sql, `g.total_score`);
    }
    if (params?.select == null || params.select.letter_grade) {
        sql = appendSelect(sql, `g.letter_grade`);
    }
    if (params?.select == null || params.select.created_at) {
        sql = appendSelect(sql, `g.created_at`);
    }
    if (params?.select == null || params.select.updated_at) {
        sql = appendSelect(sql, `g.updated_at`);
    }
    if (params?.select == null || params.select.student_id) {
        sql = appendSelect(sql, `s.id AS student_id`);
    }
    if (params?.select == null || params.select.student_name) {
        sql = appendSelect(sql, `s.name AS student_name`);
    }
    if (params?.select == null || params.select.student_email) {
        sql = appendSelect(sql, `s.email AS student_email`);
    }
    if (params?.select == null || params.select.study_program_name) {
        sql = appendSelect(sql, `sp.name AS study_program_name`);
    }
    if (params?.select == null || params.select.course_id) {
        sql = appendSelect(sql, `c.id AS course_id`);
    }
    if (params?.select == null || params.select.course_name) {
        sql = appendSelect(sql, `c.name AS course_name`);
    }
    if (params?.select == null || params.select.credits) {
        sql = appendSelect(sql, `c.credits`);
    }
    if (params?.select == null || params.select.lecturer_id) {
        sql = appendSelect(sql, `e.lecturer_id`);
    }
    sql += EOL + `FROM grades g`;
    if (params?.select == null
        || params.select.student_id
        || params.select.student_name
        || params.select.student_email
        || params.select.course_id
        || params.select.course_name
        || params.select.credits
        || params.select.lecturer_id
        || where.student_id != null
        || where.student_name != null
        || where.student_email != null
        || where.course_id != null
        || where.course_name != null
        || where.credits != null
        || where.lecturer_id != null) {
        sql += EOL + `INNER JOIN enrollments e ON g.enrollment_id = e.id`;
    }
    if (params?.select == null
        || params.select.student_id
        || params.select.student_name
        || params.select.student_email
        || params.select.study_program_name
        || where.student_id != null
        || where.student_name != null
        || where.student_email != null
        || where.study_program_name != null) {
        sql += EOL + `INNER JOIN students s ON e.student_id = s.id`;
    }
    if (params?.select == null
        || params.select.course_id
        || params.select.course_name
        || params.select.credits
        || where.course_id != null
        || where.course_name != null
        || where.credits != null) {
        sql += EOL + `INNER JOIN courses c ON e.course_id = c.id`;
    }
    if (params?.select == null
        || params.select.study_program_name
        || where.study_program_name != null) {
        sql += EOL + `INNER JOIN study_programs sp ON s.study_program_id = sp.id`;
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
        .then(res => res.map(data => mapArrayToSelectGradesResult(data, params?.select)));
}

function mapArrayToSelectGradesResult(data: any, select?: SelectGradesSelect) {
    const result = {} as SelectGradesResult;
    let rowIndex = 0;
    if (select == null || select.id) {
        result.id = data[rowIndex++];
    }
    if (select == null || select.enrollment_id) {
        result.enrollment_id = data[rowIndex++];
    }
    if (select == null || select.assignment_score) {
        result.assignment_score = data[rowIndex++];
    }
    if (select == null || select.midterm_score) {
        result.midterm_score = data[rowIndex++];
    }
    if (select == null || select.final_score) {
        result.final_score = data[rowIndex++];
    }
    if (select == null || select.total_score) {
        result.total_score = data[rowIndex++];
    }
    if (select == null || select.letter_grade) {
        result.letter_grade = data[rowIndex++];
    }
    if (select == null || select.created_at) {
        result.created_at = data[rowIndex++];
    }
    if (select == null || select.updated_at) {
        result.updated_at = data[rowIndex++];
    }
    if (select == null || select.student_id) {
        result.student_id = data[rowIndex++];
    }
    if (select == null || select.student_name) {
        result.student_name = data[rowIndex++];
    }
    if (select == null || select.student_email) {
        result.student_email = data[rowIndex++];
    }
    if (select == null || select.study_program_name) {
        result.study_program_name = data[rowIndex++];
    }
    if (select == null || select.course_id) {
        result.course_id = data[rowIndex++];
    }
    if (select == null || select.course_name) {
        result.course_name = data[rowIndex++];
    }
    if (select == null || select.credits) {
        result.credits = data[rowIndex++];
    }
    if (select == null || select.lecturer_id) {
        result.lecturer_id = data[rowIndex++];
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

function whereConditionsToObject(whereConditions?: SelectGradesWhere[]) {
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

function whereCondition(condition: SelectGradesWhere): WhereConditionResult | undefined {

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