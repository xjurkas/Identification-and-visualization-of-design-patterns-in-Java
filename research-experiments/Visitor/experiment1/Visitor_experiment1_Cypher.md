CALL {
MATCH (visitorNode)
WHERE visitorNode:Interface
   OR (visitorNode:Class AND (
         visitorNode.isAbstract = true
         OR EXISTS { MATCH (visitorNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
      ))

// Visitor type v grafe
MATCH (visitorType:Type {fqn: visitorNode.fqn})

// Spočítaj visit metódy deklarované na Visitor type
WITH visitorNode, visitorType, [
    (visitorType)-[:DECLARES]->(m:Method)
    WHERE toLower(m.name) STARTS WITH "visit"
    | m
] AS visitMethods

// Prah: aspoň 2 visit metódy
WHERE size(visitMethods) >= 2

SET visitorType:Visitor

RETURN DISTINCT visitorType, visitMethods
}

RETURN DISTINCT
  visitorType.fqn AS visitorFqn,
  [m IN visitMethods | m.name] AS visitMethodNames,
  size(visitMethods) AS visitMethodCount
ORDER BY visitorFqn;
