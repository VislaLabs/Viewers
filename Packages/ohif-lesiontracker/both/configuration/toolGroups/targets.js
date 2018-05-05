import { ToolGroupBaseSchema } from './baseSchema';
import { bidirectional } from '../tools/bidirectional';
import { targetCR } from '../tools/targetCR';
import { targetUN } from '../tools/targetUN';
import { ellipse } from '../tools/ellipse';

export const targets = {
    id: 'targets',
    name: 'Findings',
    childTools: [bidirectional, targetCR, targetUN, ellipse],
    schema: ToolGroupBaseSchema
};
