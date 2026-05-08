CALL {
MATCH (iteratorNode)
WHERE (iteratorNode:Interface
   OR (iteratorNode:Class AND (
         iteratorNode.isAbstract = true
         OR EXISTS { MATCH (iteratorNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
      )))
  AND EXISTS { MATCH (iteratorNode)-[:IN_FILE]->() }

MATCH (iteratorType:Type {fqn: iteratorNode.fqn})

// Aspoň jedna hasNext metóda AND aspoň jedna next metóda
WITH iteratorNode, iteratorType
WHERE EXISTS {
    MATCH (iteratorType)-[:DECLARES]->(m1:Method)
    WHERE toLower(m1.name) STARTS WITH "hasnext"
}
AND EXISTS {
    MATCH (iteratorType)-[:DECLARES]->(m2:Method)
    WHERE toLower(m2.name) STARTS WITH "next"
}

SET iteratorType:Iterator

RETURN DISTINCT iteratorType
}

RETURN DISTINCT
  iteratorType.fqn AS iteratorFqn
ORDER BY iteratorFqn;
