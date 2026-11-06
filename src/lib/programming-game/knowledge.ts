import type { TemplateId } from "./levels";

export type KnowledgeCard = { title: string; body: string };
export const KNOWLEDGE_LIMITS = { cards: 12, title: 120, body: 4000 } as const;

const DEFAULTS: Record<TemplateId, Record<"en" | "zh", KnowledgeCard[]>> = {
  "first-route": {
    en: [
      {
        title: "Sequential execution: order changes the result",
        body: "A program executes instructions in order. Each move starts from the position left by the previous instruction. The same commands in a different order can take a different route or hit an obstacle.\n\nConnection to code: consecutive statements normally execute from top to bottom. Before running, predict the robot's position after each statement; then use Step to check your prediction.",
      },
      {
        title: "Debugging with a trace",
        body: "A trace records how state changes after each instruction. If the robot takes a wrong turn, find the first step where the actual position differs from your prediction. Fix that instruction and run again from the initial map.\n\nReflect: why can a program execute without errors but still fail to reach its goal?",
      },
    ],
    zh: [
      {
        title: "顺序执行：指令顺序决定结果",
        body: "程序会按顺序执行指令。每次移动都从上一条指令留下的位置开始。同样的指令换一个顺序，可能走出不同路线，也可能撞到障碍。\n\n对应代码思想：连续的语句通常从上到下执行。运行前先预测每条语句执行后机器人的位置，再用“单步”检查预测。",
      },
      {
        title: "跟踪状态，定位错误",
        body: "调试时可以逐步记录状态变化。如果机器人走错路，先找出实际位置第一次与预测不同的那一步，修改对应指令，再从初始地图重新运行。\n\n思考：为什么程序没有报错，也可能没有完成目标？",
      },
    ],
  },
  "parcel-delivery": {
    en: [
      {
        title: "State: position and what the robot carries",
        body: "State is the information that describes the program at a particular moment. Here it includes the robot's position, the parcel's position and whether the robot is carrying it. Pick up and Put down change this state.\n\nConnection to code: variables store state. An operation's result depends on the current values, not just on the instruction's name.",
      },
      {
        title: "Preconditions and postconditions",
        body: "A precondition must hold before an operation: Pick up needs a parcel at the current position and empty hands; Put down needs a carried parcel. After a valid operation, check its postcondition: the parcel is now carried or has been placed on the map.\n\nReflect: reaching the goal while still carrying the parcel is different from delivering it. Which final state does this task require?",
      },
    ],
    zh: [
      {
        title: "状态：位置与携带信息",
        body: "状态是程序在某个时刻的信息。本关状态包括机器人的位置、物品的位置，以及机器人是否携带物品。“拾取”和“放下”会改变这些信息。\n\n对应代码思想：变量用于保存状态。一个操作的结果取决于当前的值，而不只取决于指令名称。",
      },
      {
        title: "前置条件与后置条件",
        body: "前置条件是在执行操作前必须满足的条件：拾取要求当前位置有物品且机器人空手；放下要求机器人已经携带物品。合法操作完成后，再检查后置条件：物品变成被携带，或者被放回地图。\n\n思考：携带物品走到目标，与把物品放在目标上有什么不同？本关要求哪一种最终状态？",
      },
    ],
  },
  "repeat-route": {
    en: [
      {
        title: "Counted loops: express repetition once",
        body: "A counted loop executes its body exactly N times. A body containing one Right move repeated four times performs four moves. If the body contains two instructions, four repetitions execute eight atomic instructions.\n\nConnection to code: a counted for loop avoids writing the same statements repeatedly. This game uses a structured Repeat instruction rather than executing JavaScript.",
      },
      {
        title: "Iteration counts and boundary errors",
        body: "One repetition too few can leave the robot short of its goal; one too many can move it out of bounds. Predict the state after each iteration and check it with Step.\n\nA shorter written program does not necessarily do less work: loop nodes, repetitions and executed steps measure different things. Reflect: what changes if you add a second instruction inside the loop?",
      },
    ],
    zh: [
      {
        title: "固定次数循环：把重复写成一个结构",
        body: "固定次数循环会把循环体执行恰好 N 次。“重复 4 次：向右”会移动四次。如果循环体有两条指令，重复四次就会执行八条原子指令。\n\n对应代码思想：计数型 for 循环可以避免重复书写相同语句。本游戏使用结构化的“重复”指令，不会执行 JavaScript。",
      },
      {
        title: "循环次数与边界错误",
        body: "少循环一次可能到不了目标，多循环一次可能越界。先预测每次迭代后的状态，再使用“单步”观察并检查。\n\n程序写得更短，不代表执行的工作更少：程序节点数、循环次数和实际执行步数是不同指标。思考：在循环体中加入第二条指令，会有什么变化？",
      },
    ],
  },
};

export function getDefaultKnowledge(
  id: TemplateId,
  locale: "en" | "zh",
): KnowledgeCard[] {
  return DEFAULTS[id][locale].map((card) => ({ ...card }));
}

/** Bounded plain text only. Never interpret teacher text as HTML or code. */
export function parseKnowledge(value: unknown): KnowledgeCard[] {
  if (!Array.isArray(value) || value.length > KNOWLEDGE_LIMITS.cards)
    throw new Error("INVALID_KNOWLEDGE");
  return value.map((card) => {
    if (
      !card ||
      typeof card !== "object" ||
      typeof card.title !== "string" ||
      typeof card.body !== "string" ||
      card.title.length > KNOWLEDGE_LIMITS.title ||
      card.body.length > KNOWLEDGE_LIMITS.body
    )
      throw new Error("INVALID_KNOWLEDGE");
    return { title: card.title, body: card.body };
  });
}
