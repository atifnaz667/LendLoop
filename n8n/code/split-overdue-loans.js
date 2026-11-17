// One item per overdue loan. An empty list ends the run (nothing to remind).
const { loans = [], asOf } = $input.first().json;
return loans.map((loan) => ({ json: { ...loan, asOf } }));
