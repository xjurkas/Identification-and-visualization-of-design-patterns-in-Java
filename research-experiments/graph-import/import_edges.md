// Once again, dont forget to use raw.link in <URL> from github

CALL apoc.periodic.iterate(
  'CALL apoc.load.json("<URL>") YIELD value 
   UNWIND value.edges AS ed 
   RETURN ed',
  'MATCH (s:Entity {id: ed.from})
   MATCH (t:Entity {id: ed.to})
   CALL apoc.create.relationship(s, ed.type, {propsJson: apoc.convert.toJson(ed)}, t) 
   YIELD rel
   RETURN rel',
  {batchSize: 500, parallel: false}
) YIELD batches, total, errorMessages
RETURN batches, total, errorMessages;