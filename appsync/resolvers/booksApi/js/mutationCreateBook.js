import { util } from '@aws-appsync/utils';
import { put } from '@aws-appsync/utils/dynamodb';

/**
 * Puts an item into the DynamoDB table using an auto-generated ID.
 * @param {import('@aws-appsync/utils').Context<{input: any}>} ctx the context
 * @returns {import('@aws-appsync/utils').DynamoDBPutItemRequest} the request
 */
export function request(ctx) {
    const { input: values } = ctx.args;
    const key = { id: values.id ?? util.autoId() };
    const condition = { and: [{ id: { attributeExists: false } }] };
    
    return put({
        key,
        item: ctx.args.input,
        condition,
    })
}

/**
 * Returns the item or throws an error if the operation failed.
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the result
 */
export function response(ctx) {
    const { error, result } = ctx;
    if (error) {
        return util.appendError(error.message, error.type, result);
    }
    return result;
}