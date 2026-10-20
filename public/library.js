// Hooks and endings library for Social Media Studio.
// Original content, aligned with Ritesh's Persona Guide (sections 17, 22 and 26):
// approved hook formats, approved calls to action, no engagement bait, no "hot take",
// no announcements without an insight, nothing aimed at the reader.
// Each entry: a template with [placeholders], tags (first tag = purpose), three examples.
// Purposes: view (sharing a view), how-to (teaching a task), built (sharing something built),
// story (telling a story), milestone (news framed around an insight).
// [real number] means: only use a number you can back up.

window.LIBRARY = {
  hooks: [
    // ----- Idea-led reframe (sharing a view)
    { template: "[Common belief] sounds right.\nIt usually isn't.\nHere is what I see instead:", tags: ["view", "reframe"],
      examples: ["More data sounds like more insight.\nIt usually isn't.\nHere is what I see instead:", "A favorable variance sounds like good news.\nIt usually isn't.\nHere is what I see instead:", "A faster close sounds like a better close.\nIt usually isn't.\nHere is what I see instead:"] },
    { template: "[Bold statement about the idea].\n\nUsually [X]. The exception is [Y].", tags: ["view", "boundary"],
      examples: ["Most finance AI tools are ahead of our data.\n\nUsually the fix is cleaner inputs. The exception is reconciliation, where the tools are already useful.", "The model is rarely the problem in a forecast miss.\n\nUsually it is a hidden assumption. The exception is a true one-off event.", "Dashboards rarely change decisions on their own.\n\nUsually the conversation does. The exception is a metric nobody was tracking before."] },
    { template: "[Short, specific statement].\n\n[One line of context that makes it matter].", tags: ["view", "story"],
      examples: ["The model was right.\n\nThe meeting still went badly.", "One road in North Carolina matters to the whole AI industry.\n\nAnd most models never mention it.", "Claude went down today.\n\nAnd I noticed how much of my thinking I hand to it."] },
    { template: "The [thing] is rarely the problem.\nThe [hidden thing] is.", tags: ["view", "reframe"],
      examples: ["The forecast is rarely the problem.\nThe assumption nobody wrote down is.", "The tool is rarely the problem.\nThe data going into it is.", "The variance is rarely the problem.\nThe explanation that arrives three days late is."] },
    { template: "Code calculates. Models explain. [People] decide.\n\nHere is where [topic] fits:", tags: ["view", "ai"],
      examples: ["Code calculates. Models explain. Humans make the judgment.\n\nHere is where AI fits in our close:", "Code calculates. Models explain. Finance decides.\n\nHere is where agents fit in FP&A today:", "Code calculates. Models explain. Leaders decide.\n\nHere is where a forecast fits:"] },
    { template: "Early read on [new thing]: [cautious view].", tags: ["view", "learning"],
      examples: ["Early read on AI agents in finance: useful for the first draft, not yet for the final number.", "Early read on DAX after two months: powerful, and less forgiving than Power Query.", "Early read on semantic models: they fix definitions faster than they fix reports."] },
    { template: "Now: [what is true today].\nLater (about [timeframe]): [what changes].", tags: ["view", "ai"],
      examples: ["Now: analysts need to know how the work is done, because AI can't be fully trusted yet.\nLater (about five years): what's left is understanding and explaining the business.", "Now: most finance AI pilots are about drafting.\nLater (about three years): they will be about checking.", "Now: the close is where finance spends its time.\nLater (about five years): it will be the part nobody notices."] },

    // ----- "I used to think X"
    { template: "I used to think [old belief].\n\nThen [what changed my mind].", tags: ["view", "story"],
      examples: ["I used to think a better model meant a better forecast.\n\nThen I watched a simple one win because everyone understood it.", "I used to think AI would replace the analyst's work.\n\nThen I saw how much checking its work takes.", "I used to think reconciliation was a chore.\n\nThen it became the reason leadership trusted our ARR."] },
    { template: "I used to [old habit].\nNow I [new habit].\n\nHere is why:", tags: ["how-to", "story"],
      examples: ["I used to send the full model.\nNow I send the three numbers that changed.\n\nHere is why:", "I used to hardcode adjustments.\nNow I log every one.\n\nHere is why:", "I used to ask AI for answers.\nNow I ask it to check my thinking.\n\nHere is why:"] },

    // ----- Myth-bust aimed at a belief (never at a person)
    { template: "\"[Belief people repeat].\"\n\nNot quite.\n[What is actually true].", tags: ["view", "myth"],
      examples: ["\"Payments are a finance problem.\"\n\nNot quite.\nFailed payments are a revenue problem first.", "\"AI will make analysts faster.\"\n\nNot quite.\nIt makes good analysts faster and unchecked work wrong faster.", "\"The budget is the plan.\"\n\nNot quite.\nThe budget is the first draft of the plan."] },
    { template: "A common belief in [field]: [belief].\nWhat I see in practice: [reality].", tags: ["view", "myth"],
      examples: ["A common belief in FP&A: more drivers make a better forecast.\nWhat I see in practice: three good drivers beat twelve weak ones.", "A common belief in SaaS: churn shows up in the churn report.\nWhat I see in practice: it shows up in failed payments first.", "A common belief about AI: it needs perfect data.\nWhat I see in practice: it needs documented data."] },

    // ----- Quantified effort (real numbers only)
    { template: "[Real number] [hours/weeks/versions] to [result].\nHere is what made the difference:", tags: ["built", "effort"],
      examples: ["[Real number] versions of our ARR waterfall before leadership trusted it.\nHere is what made the difference:", "[Real number] weeks to automate the monthly sales report.\nHere is what made the difference:", "[Real number] hours a month back after one Power Query change.\nHere is what made the difference:"] },
    { template: "I rebuilt [thing] [real number] times.\nThe last version worked because of one change:", tags: ["built", "effort"],
      examples: ["I rebuilt our ARR report [real number] times.\nThe last version worked because of one change:", "I rebuilt the variance template [real number] times.\nThe last version worked because of one change:", "I rebuilt my prompt library [real number] times.\nThe last version worked because of one change:"] },

    // ----- Sharing something built
    { template: "I built [thing] to solve [finance problem].\n\nWhat worked, what broke, and what you can reuse:", tags: ["built"],
      examples: ["I built a live ARR waterfall in Python to stop reconciling three versions of the truth.\n\nWhat worked, what broke, and what you can reuse:", "I built a knowledge vault so our team stops answering the same questions twice.\n\nWhat worked, what broke, and what you can reuse:", "I built a validation step into our AI workflow so no number leaves unchecked.\n\nWhat worked, what broke, and what you can reuse:"] },
    { template: "The problem: [finance problem].\nWhat I built: [solution].\nThe part that surprised me: [lesson].", tags: ["built"],
      examples: ["The problem: three teams, three ARR numbers.\nWhat I built: one waterfall everyone pulls from.\nThe part that surprised me: the hard part was definitions, not code.", "The problem: the same budget questions every month.\nWhat I built: a searchable FP&A wiki.\nThe part that surprised me: writing it down changed how we answer.", "The problem: AI drafts nobody could trust.\nWhat I built: a checking step with tie-outs.\nThe part that surprised me: the checks were faster than the drafts."] },

    // ----- Teaching a task (open on a recognizable situation)
    { template: "It's [moment in the cycle], and [recognizable situation].\n\nHere is how I handle it:", tags: ["how-to"],
      examples: ["It's day three of the close, and the variance doesn't tie.\n\nHere is how I handle it:", "It's budget season, and every department wants more headcount.\n\nHere is how I handle it:", "It's Monday morning, and the report needs refreshing again.\n\nHere is how I handle it:"] },
    { template: "Here is how I [task] in [time]:", tags: ["how-to"],
      examples: ["Here is how I review a large model in 15 minutes:", "Here is how I write variance commentary leadership actually reads:", "Here is how I check an AI-generated number before I share it:"] },
    { template: "The [real number]-step check I run before [activity]:", tags: ["how-to", "checklist"],
      examples: ["The 4-step check I run before sending any forecast:", "The 3-step check I run before trusting an AI number:", "The 5-step check I run before a board deck goes out:"] },
    { template: "The prompt I use to [task], word for word:", tags: ["how-to", "ai"],
      examples: ["The prompt I use to draft variance commentary, word for word:", "The prompt I use to check a formula for errors, word for word:", "The prompt I use to explain ARR to a new hire, word for word:"] },
    { template: "Stop [habit]. Start [better habit].\n\nWhy it matters:", tags: ["how-to", "advice"],
      examples: ["Stop sending the full model. Start sending what changed.\n\nWhy it matters:", "Stop asking AI for the answer. Start asking it to check yours.\n\nWhy it matters:", "Stop hardcoding adjustments. Start logging them.\n\nWhy it matters:"] },
    { template: "[Topic] in one sentence: [plain explanation].", tags: ["how-to", "explain"],
      examples: ["Net revenue retention in one sentence: how much your existing customers grow, without new logos.", "A rolling forecast in one sentence: always looking twelve months ahead, never stopping at year end.", "A tie-out in one sentence: proving two numbers that should match actually do."] },
    { template: "If you're starting in [field], [practical advice].", tags: ["how-to", "career"],
      examples: ["If you're starting in FP&A, sit with sales for a week before you build a forecast.", "If you're learning Python for finance, start with one annoying task you do every month.", "If you're new to SaaS metrics, learn the ARR bridge before anything else."] },

    // ----- Telling a story
    { template: "[Time] ago I [situation].\nToday I [current situation].\n\nThe lesson in between:", tags: ["story", "career"],
      examples: ["A year ago I was a revenue analyst.\nToday I work in FP&A.\n\nThe lesson in between:", "Two years ago I had never written code.\nToday I automate my own reporting.\n\nThe lesson in between:", "Six months ago I avoided AI tools.\nToday I use them before every meeting.\n\nThe lesson in between:"] },
    { template: "I got [thing] wrong.\n\nWhat happened, how I fixed it, and what changed:", tags: ["story", "failure"],
      examples: ["I got a forecast assumption wrong last quarter.\n\nWhat happened, how I fixed it, and what changed:", "I got the timing of a board update wrong.\n\nWhat happened, how I fixed it, and what changed:", "I trusted an AI number too early.\n\nWhat happened, how I fixed it, and what changed:"] },
    { template: "This [ordinary thing] changed how I think about [bigger topic].", tags: ["story", "view"],
      examples: ["This one spreadsheet tab changed how I think about trust.", "A rejected ticket purchase changed how I think about systems.", "A five-minute call changed how I think about forecasting."] },
    { template: "[Person or role] asked me [question].\n\nMy answer:", tags: ["story", "how-to"],
      examples: ["A new analyst asked me which Excel skill matters most.\n\nMy answer:", "A sales leader asked me why ARR and bookings never match.\n\nMy answer:", "My manager asked me how much to trust an AI forecast.\n\nMy answer:"] },

    // ----- Milestones framed around an insight (never a bare announcement)
    { template: "[Milestone].\n\nThe part that stayed with me: [insight].", tags: ["milestone"],
      examples: ["I finished my MBA in Business Analytics.\n\nThe part that stayed with me: the best models were the ones people understood.", "I moved from revenue analytics into FP&A this year.\n\nThe part that stayed with me: unfamiliar does not mean unqualified.", "I was selected for the Bertelsmann Scholarship.\n\nThe part that stayed with me: in finance, staying relevant means learning on purpose."] },
    { template: "[Milestone] taught me [real number] things about [topic]:", tags: ["milestone", "list"],
      examples: ["My first year in FP&A taught me 4 things about influence:", "Finishing my MBA taught me 3 things about learning while working:", "My first year building with AI taught me 5 things about checking work:"] },

    // ----- Lists and questions
    { template: "[Real number] [things] that [specific benefit]:", tags: ["how-to", "list"],
      examples: ["5 Power Query steps that replaced our Monday copy-paste:", "3 prompts I use every week in FP&A:", "4 questions I ask before building any model:"] },
    { template: "What [finance situation] would change if [condition]?", tags: ["view", "question"],
      examples: ["What assumption in your business would hurt most if it broke?", "What report would you stop producing if nobody asked for it?", "What would your forecast look like with only three drivers?"] },
    { template: "[News or event].\n\nWhat it means for [finance audience]:", tags: ["view", "news"],
      examples: ["Walmart put checkout inside ChatGPT.\n\nWhat it means for anyone who forecasts demand:", "Another AI model launched this week.\n\nWhat it means for finance teams already using one:", "Rates moved again.\n\nWhat it means for next year's budget assumptions:"] },
  ],

  endings: [
    // ----- Principle line (often a couplet), placed before the call to action
    { template: "[Principle line].\n[Second line that sharpens it].", tags: ["principle"],
      examples: ["Use AI to accelerate your thinking.\nNot to replace it.", "Unfamiliar does not mean unqualified.\nIt usually means you are learning.", "Most outcomes are mechanical.\nOnce you stop taking them personally, you design better paths."] },
    { template: "The tools will change.\n[Lasting principle] will not.", tags: ["principle", "ai"],
      examples: ["The tools will change.\nJudgment will not.", "The tools will change.\nThe need for clean data will not.", "The tools will change.\nThe need for trust will not."] },
    { template: "[Short recap]:\n[Point 1]\n[Point 2]\n[Point 3]", tags: ["principle", "recap"],
      examples: ["In short:\nState your assumptions.\nTrack your changes.\nExplain the why.", "The recipe:\nOne driver.\nOne chart.\nOne recommendation.", "What to keep:\nClean inputs.\nDocumented steps.\nA human check at the end."] },
    { template: "Trust the number when you understand the method.", tags: ["principle", "ai"],
      examples: ["Trust the number when you understand the method.", "Trust the forecast when you can explain the drivers.", "Trust the dashboard when you know where the data comes from."] },

    // ----- Curiosity (approved call to action)
    { template: "I'd love to learn how others handle [this situation].", tags: ["cta", "curiosity"],
      examples: ["I'd love to learn how others handle this.", "I'd love to learn how other FP&A teams run this review.", "I'd love to learn how your team checks AI output before it reaches leadership."] },
    { template: "Curious: [specific question for practitioners]?", tags: ["cta", "curiosity"],
      examples: ["Curious: what assumption would hurt your business most if it broke?", "Curious: which report would your team stop producing if it could?", "Curious: where has AI saved your team real time so far?"] },

    // ----- Try it (approved call to action)
    { template: "Try this at your next [moment].", tags: ["cta", "try-it"],
      examples: ["Try this at your next close.", "Try this at your next budget review.", "Try this the next time a variance doesn't tie."] },

    // ----- Offer (approved call to action)
    { template: "Happy to share the [resource] if it's useful.", tags: ["cta", "offer"],
      examples: ["Happy to share the template if it's useful.", "Happy to share the full prompt if it's useful.", "Happy to share the checklist if it's useful."] },

    // ----- Practical P.S. (approved call to action)
    { template: "P.S. [Practical tip or detail].", tags: ["cta", "ps"],
      examples: ["P.S. The same check works in Google Sheets.", "P.S. Start with one report, not ten.", "P.S. If your data isn't documented, start there before any AI tool."] },

    // ----- Full piece on Substack (approved call to action)
    { template: "The full [walkthrough/prompts/steps] are in this week's Analyst Playbook on Substack.", tags: ["cta", "substack"],
      examples: ["The full walkthrough is in this week's Analyst Playbook on Substack.", "The exact prompts are in this week's Analyst Playbook on Substack.", "The step-by-step version is in this week's Analyst Playbook on Substack."] },

    // ----- Credit and personal (allowed: positive credit to people by name)
    { template: "Thank you to [person or team] for [specific contribution].", tags: ["credit"],
      examples: ["Thank you to my team for testing the first version.", "Thank you to Bertelsmann for the opportunity to learn this.", "Thank you to everyone who pushed back on the first draft. It's better for it."] },
    { template: "If you're [situation], [encouraging, practical advice].", tags: ["principle", "career"],
      examples: ["If you're stepping into a new role this year, ask the questions you didn't need to ask before.", "If you're early in your career, spend time with people who have forecast through a downturn.", "If you're learning to code, start with one task you repeat every month."] },
  ],
};
