/*
 *
 *  * Copyright 2023 ZETARIS Pty Ltd
 *  *
 *  * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 *  * associated documentation files (the "Software"), to deal in the Software without restriction,
 *  * including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *  * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
 *  * subject to the following conditions:
 *  *
 *  * The above copyright notice and this permission notice shall be included in all copies
 *  * or substantial portions of the Software.
 *  *
 *  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 *  * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *  * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 *  * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

package com.zetaris.lightning.datasources.v2.image

import com.zetaris.lightning.datasources.v2.UnstructuredData._
import com.zetaris.lightning.datasources.v2.{UnstructuredData, UnstructuredFileScanBuilder, UnstructuredFileTable, UnstructuredFileWrite}
import com.zetaris.lightning.execution.command.DataSourceType
import com.zetaris.lightning.execution.command.DataSourceType.DataSourceType
import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.connector.write.{LogicalWriteInfo, Write, WriteBuilder}
import org.apache.spark.sql.execution.datasources.FileFormat
import org.apache.spark.sql.types._
import org.apache.spark.sql.util.CaseInsensitiveStringMap

case class ImageTable(name: String,
                      sparkSession: SparkSession,
                      opts: Map[String, String],
                      paths: Seq[String],
                      fallbackFileFormat: Class[_ <: FileFormat] = null,
                      tagSchema: StructType)
  extends UnstructuredFileTable(sparkSession, opts, paths, if (name.toLowerCase == UnstructuredData.CONTENT) {
    Some(StructType(
      StructField(PATH, StringType, false,
        UnstructuredData.buildMetadata(
          UnstructuredData.mapWithFileFormat(UnstructuredData.mapWithFilePath(Map(), paths.head),
          DataSourceType.IMAGE))) ::
          StructField(IMAGECONTENT, BinaryType, false) :: Nil
    ))
  } else {
    Some(StructType(
      StructField(FILETYPE, StringType, true) ::
        StructField(PATH, StringType, false,
          UnstructuredData.buildMetadata(
            UnstructuredData.mapWithFileFormat(UnstructuredData.mapWithFilePath(Map(), paths.head),
              DataSourceType.IMAGE))) ::
        StructField(MODIFIEDAT, TimestampType, false) ::
        StructField(SIZEINBYTES, LongType, false) ::
        StructField(WIDTH, IntegerType, false) ::
        StructField(HEIGHT, IntegerType, false) ::
        StructField(TAGS, StringType, false) ::
        StructField(IMAGETHUMBNAIL, BinaryType, false) :: Nil
    ))
  }, "image") {
  override def newScanBuilder(options: CaseInsensitiveStringMap): UnstructuredFileScanBuilder =
    new UnstructuredFileScanBuilder(sparkSession, fileIndex, dataSchema, recursiveScanSchema) {
      override def build(): ImageScan = {
        ImageScan(sparkSession,
          fileIndex,
          dataSchema,
          readDataSchema(),
          readPartitionSchema(),
          recursiveScanSchema,
          tagSchema,
          rootPathsSpecified,
          pushedDataFilters,
          opts,
          partitionFilters,
          dataFilters,
          name.toLowerCase.equals(UnstructuredData.CONTENT))
      }
    }

  override def newWriteBuilder(info: LogicalWriteInfo): WriteBuilder = {
    new WriteBuilder {
      override def build(): Write =
        UnstructuredFileWrite(DataSourceType.IMAGE, paths, formatName, supportsDataType, info, opts)
    }
  }

}
