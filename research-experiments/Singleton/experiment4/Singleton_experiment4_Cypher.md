CALL {
MATCH (classNode:Class)
MATCH (classType:Type {fqn: classNode.fqn})
MATCH (classType)-[:HAS_FIELD]->(instanceField:Field)-[:FIELD_TYPE]->(classType)
WHERE instanceField.isStatic = true
   OR EXISTS {
        MATCH (instanceField)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      }
MATCH (classType)-[:DECLARES]->(accessorMethod:Method)
WHERE (accessorMethod.isStatic = true
   OR EXISTS {
        MATCH (accessorMethod)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      })
  AND NOT EXISTS {
        MATCH (accessorMethod)-[:HAS_PARAMETER]->()
      }
WITH classNode, classType, instanceField, accessorMethod
WHERE EXISTS { MATCH (accessorMethod)-[:RETURN_TYPE]->(classType) }
   OR accessorMethod.returnType = classNode.name
   OR accessorMethod.returnType STARTS WITH (classNode.name + "<")
SET classType:Singleton

RETURN DISTINCT classType, instanceField, accessorMethod
}

RETURN DISTINCT
  classType.fqn AS singletonFqn,
  instanceField.name AS instanceFieldName,
  accessorMethod.name AS accessorMethodName
ORDER BY singletonFqn;
