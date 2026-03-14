-- CreateTable
CREATE TABLE "VariableValueHiddenVariable" (
    "id" TEXT NOT NULL,
    "value_id" TEXT NOT NULL,
    "variable_id" TEXT NOT NULL,

    CONSTRAINT "VariableValueHiddenVariable_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VariableValueHiddenVariable" ADD CONSTRAINT "VariableValueHiddenVariable_value_id_fkey" FOREIGN KEY ("value_id") REFERENCES "VariableValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariableValueHiddenVariable" ADD CONSTRAINT "VariableValueHiddenVariable_variable_id_fkey" FOREIGN KEY ("variable_id") REFERENCES "Variable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
