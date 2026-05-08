CALL {
MATCH (classNode:Class)
MATCH (classType:Type {fqn: classNode.fqn})

// 1. Statický field vlastného typu
MATCH (classType)-[:HAS_FIELD]->(instanceField:Field)-[:FIELD_TYPE]->(classType)
WHERE instanceField.isStatic = true
   OR EXISTS {
        MATCH (instanceField)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      }

// 2. Statický accessor bez parametrov
MATCH (classType)-[:DECLARES]->(accessorMethod:Method)
WHERE (accessorMethod.isStatic = true
   OR EXISTS {
        MATCH (accessorMethod)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      })
  AND NOT EXISTS {
        MATCH (accessorMethod)-[:HAS_PARAMETER]->()
      }

// 3. Accessor vracia rovnaký typ
WITH classNode, classType, instanceField, accessorMethod
WHERE (EXISTS { MATCH (accessorMethod)-[:RETURN_TYPE]->(classType) }
   OR accessorMethod.returnType = classNode.name
   OR accessorMethod.returnType STARTS WITH (classNode.name + "<"))

// NOVÉ: Accessor musí mať meno typické pre Singleton
  AND (
       toLower(accessorMethod.name) STARTS WITH "getinstance"
    OR toLower(accessorMethod.name) STARTS WITH "getdefault"
    OR toLower(accessorMethod.name) STARTS WITH "getcurrent"
    OR toLower(accessorMethod.name) STARTS WITH "getshared"
    OR toLower(accessorMethod.name) = "get" + toLower(classNode.name)
    OR toLower(accessorMethod.name) = "get"
  )

SET classType:Singleton

RETURN DISTINCT classType, instanceField, accessorMethod
}

RETURN DISTINCT
  classType.fqn AS singletonFqn,
  instanceField.name AS instanceFieldName,
  accessorMethod.name AS accessorMethodName
ORDER BY singletonFqn;
