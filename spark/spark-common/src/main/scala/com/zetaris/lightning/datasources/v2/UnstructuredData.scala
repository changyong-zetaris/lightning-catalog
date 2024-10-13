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

package com.zetaris.lightning.datasources.v2

import com.drew.metadata.{Metadata, Tag}
import com.zetaris.lightning.execution.command.DataSourceType
import com.zetaris.lightning.execution.command.DataSourceType.DataSourceType
import net.coobird.thumbnailator.Thumbnails
import org.apache.spark.sql.catalyst.util.CaseInsensitiveMap
import org.apache.spark.sql.sources._
import org.apache.spark.sql.types.MetadataBuilder

import java.awt.Dimension
import java.io.{ByteArrayInputStream, ByteArrayOutputStream}
import scala.collection.JavaConverters._

object UnstructuredData {
  val FILETYPE = "type"
  val FORMAT = "format"
  val PATH = "path"
  val MODIFIEDAT = "modifiedat"
  val SIZEINBYTES = "sizeinbytes"
  val PREVIEW = "preview"
  val IMAGETHUMBNAIL = "imagethumbnail"

  val TAGS = "tags"
  val WIDTH = "width"
  val HEIGHT = "height"
  val LENGTH = "length"
  val CONTENT = "content"

  val TEXTCONTENT = "textcontent"
  val BINCONTENT = "bincontent"
  val IMAGECONTENT = "imagecontent"
  val VIDEOCONTENT = "videocontent"
  val VIDEOTHUMBNAIL = "videothumbnail"

  val SUBDIR = "subdir"

  // tag names
  val DURATION = "duration"
  val DURATION_IN_SECS = "duration in seconds"
  val FILE_SIZE = "file_size"
  val DETECTED_FILE_TYPE_NAME = "detected file type name"
  val COMPRESSION_TYPE = "compression type"
  val MEDIA_TIME_SCALE = "Media Time Scale"

  val PDF_SHORT_NAME = "pdf"
  val PDF_PREVIEW_KEY = "pdf_preview_len"
  val PDF_PREVIEW_LEN = 1000

  val IMAGE_THUMBNAIL_WIDTH_KEY = "image_thumbnail_with"
  val IMAGE_THUMBNAIL_HEIGHT_KEY = "image_thumbnail_height"
  val IMAGE_THUMBNAIL_WIDTH_DEFAULT = 100
  val IMAGE_THUMBNAIL_HEIGHT_DEFAULT = 100

  object ScanType {
    def apply(scanType: String): ScanType = {
      scanType.toLowerCase match {
        case "file_scan" => FILE_SCAN
        case "recursive_scan" => RECURSIVE_SCAN
        case "parts_scan" => PARTS_SCAN
        case _ => throw new IllegalArgumentException(s"unsupported scantype : $scanType")
      }
    }
  }
  sealed trait ScanType
  case object FILE_SCAN extends ScanType
  case object RECURSIVE_SCAN extends ScanType
  case object PARTS_SCAN extends ScanType

  private[v2] case class MetaData(fileType: String,
                                  path: String,
                                  modifiedAt: Long,
                                  sizeInBytes: Long,
                                  preview: String,
                                  subDir: String,
                                  tags: String = null,
                                  textContent: String = null,
                                  binContent: Array[Byte] = null,
                                  imageDim: Dimension = null,
                                  duration: Float = -1.0f,
                                  format: String = null,
                                  fileTag: CaseInsensitiveMap[Any] = null)

  def extractEmbeddedTags(metadata: Metadata): List[Tag] = {
    metadata.getDirectories.asScala
      .flatMap(dir => dir.getTags.asScala)
      .toList
      .filter { tag =>
        tag.getTagName.toLowerCase match {
          case DURATION_IN_SECS        => true
          case DURATION                => true
          case FILE_SIZE               => true
          case DETECTED_FILE_TYPE_NAME => true
          case COMPRESSION_TYPE        => true
          case WIDTH                   => true
          case HEIGHT                  => true
          case _                       => false
        }
      }
  }

  def getFieldValue(field: String, metaData: MetaData): Any = {
    field.toLowerCase match {
      case UnstructuredData.FILETYPE => metaData.fileType
      case UnstructuredData.PATH => metaData.path
      case UnstructuredData.MODIFIEDAT => metaData.modifiedAt
      case UnstructuredData.SIZEINBYTES => metaData.sizeInBytes
      case UnstructuredData.PREVIEW => metaData.preview
      case UnstructuredData.SUBDIR => metaData.subDir
      case UnstructuredData.WIDTH => metaData.imageDim.width
      case UnstructuredData.HEIGHT => metaData.imageDim.height
      case UnstructuredData.IMAGETHUMBNAIL => metaData.binContent
      case UnstructuredData.TAGS => metaData.tags
      case UnstructuredData.TEXTCONTENT => metaData.textContent
      case UnstructuredData.BINCONTENT => metaData.binContent
      case UnstructuredData.DURATION => metaData.duration
      case UnstructuredData.FORMAT => metaData.format
      case other => if (metaData.fileTag == null ) {
        null
      } else {
        metaData.fileTag.getOrElse(other, null)
      }
    }
  }

  def createFilter(filter: Filter): Function1[MetaData, Boolean] = {
    filter match {
      case IsNull(_) => _ => false
      case IsNotNull(_) => _ => true
      case EqualTo(field, value) => md =>
        getFieldValue(field, md).equals(value)
      case Not(EqualTo(field, value)) => md =>
        !getFieldValue(field, md).equals(value)
      case EqualNullSafe(field, value) => md =>
        getFieldValue(field, md).equals(value)
      case Not(EqualNullSafe(field, value)) => md =>
        !getFieldValue(field, md).equals(value)
      case LessThan(field, value) => md =>
        getFieldValue(field, md).toString.toDouble < value.toString.toDouble
      case LessThanOrEqual(field, value) => md =>
        getFieldValue(field, md).toString.toDouble <= value.toString.toDouble
      case GreaterThan(field, value) => md =>
        getFieldValue(field, md).toString.toDouble > value.toString.toDouble
      case GreaterThanOrEqual(field, value) => md =>
        getFieldValue(field, md).toString.toDouble >= value.toString.toDouble
      case And(left, right) => md =>
        val leftFilter = createFilter(left)
        val rightFilter = createFilter(right)
        leftFilter(md) && rightFilter(md)
      case Or(left, right) => md =>
        val leftFilter = createFilter(left)
        val rightFilter = createFilter(right)
        leftFilter(md) || rightFilter(md)
      case Not(pref) => md =>
        val neg = createFilter(pref)
        !neg(md)
      case In(field, values) => md =>
        val fieldVal = getFieldValue(field, md)
        values.map(v => fieldVal.equals(v)).reduceLeft(_ || _)
      case StringStartsWith(field, prefix) => md =>
        val fieldVal = getFieldValue(field, md)
        fieldVal.toString.startsWith(prefix)
      case StringEndsWith(field, suffix) => md =>
        val fieldVal = getFieldValue(field, md)
        fieldVal.toString.endsWith(suffix)
      case StringContains(field, value) => md =>
        val fieldVal = getFieldValue(field, md)
        fieldVal.toString.indexOf(value) >= 0
      case _ =>  _ => false

    }
  }

  def thumbnailImage(content: Array[Byte], width: Int, height: Int): Array[Byte] = {
    val is = new ByteArrayInputStream(content)
    val tis = Thumbnails.of(is)
    tis.size(width, height)
    val os = new ByteArrayOutputStream()
    tis.toOutputStream(os)
    os.toByteArray
  }

  def mapWithFileFormat(opts: Map[String, String], dataSourceType: DataSourceType): Map[String, String] = {
    opts ++ Map("fileFormat" -> dataSourceType.toString)
  }

  def extractFileFormat(opts: Map[String, String]): Option[DataSourceType] = {
    opts.get("fileFormat").map(DataSourceType(_))
  }

  def buildMetadata(opts: Map[String, String]): org.apache.spark.sql.types.Metadata = {
    val mb = new MetadataBuilder()
    opts.foreach {
      case (k, v) => mb.putString(k, v)
    }
    mb.build()
  }

  def mapWithFilePath(opts: Map[String, String], filePath: String): Map[String, String] = {
    opts ++ Map("filePath" -> filePath)
  }

  def getFilePathFromMetadata(md: org.apache.spark.sql.types.Metadata): String  = {
    md.getString("filePath")
  }

  def getFileFormatFromMetadata(md: org.apache.spark.sql.types.Metadata): Option[DataSourceType]  = {
    Option(md.getString("fileFormat")).map(DataSourceType(_))
  }

}
