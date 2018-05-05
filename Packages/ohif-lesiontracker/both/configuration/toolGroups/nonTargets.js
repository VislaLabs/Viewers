import { ToolGroupBaseSchema } from './baseSchema';
import { nonTarget } from '../tools/nonTarget';
import { ellipse } from '../tools/ellipse';

export const nonTargets = {
    id: 'nonTargets',
    name: 'Non-Targets',
    childTools: [nonTarget, ellipse],
    schema: ToolGroupBaseSchema
};
