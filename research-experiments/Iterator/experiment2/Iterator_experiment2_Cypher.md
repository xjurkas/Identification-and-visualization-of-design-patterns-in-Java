CALL {
MATCH (iteratorNode)
WHERE (iteratorNode:Interface
   OR (iteratorNode:Class AND (
         iteratorNode.isAbstract = true
         OR EXISTS { MATCH (iteratorNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
      )))
  AND EXISTS { MATCH (iteratorNode)-[:IN_FILE]->() }

MATCH (iteratorType:Type {fqn: iteratorNode.fqn})

WITH iteratorNode, iteratorType
WHERE (
    // A: hasNext + next
    (EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m1:Method)
        WHERE toLower(m1.name) STARTS WITH "hasnext"
    }
    AND EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m2:Method)
        WHERE toLower(m2.name) STARTS WITH "next"
    })
    OR
    // B: hasMoreElements + nextElement (Enumeration-style)
    (EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m3:Method)
        WHERE toLower(m3.name) STARTS WITH "hasmoreelements"
    }
    AND EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m4:Method)
        WHERE toLower(m4.name) STARTS WITH "nextelement"
    })
    OR
    // C: hasMore + next (alternatíva)
    (EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m5:Method)
        WHERE toLower(m5.name) STARTS WITH "hasmore"
          AND NOT toLower(m5.name) STARTS WITH "hasmoreelements"
    }
    AND EXISTS {
        MATCH (iteratorType)-[:DECLARES]->(m6:Method)
        WHERE toLower(m6.name) STARTS WITH "next"
          AND NOT toLower(m6.name) STARTS WITH "nextelement"
    })
)

SET iteratorType:Iterator

RETURN DISTINCT iteratorType
}

RETURN DISTINCT
  iteratorType.fqn AS iteratorFqn
ORDER BY iteratorFqn;
