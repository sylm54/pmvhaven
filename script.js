const PLATFORM = "Hypnotube";

var config = {};
var settings = {};
//Source Methods
source.enable = function (conf, sett, savedState) {
  config = conf ?? {};
  settings = sett ?? {};
};

source.setSettings = function(newsettings) {
	settings = newsettings;
}


source.getHome = function () {
  return new FeedPager({mode: "GetTrending"});
};

source.searchSuggestions = function (query) {
  return [];
};
source.getSearchCapabilities = () => {
  return {
    types: [Type.Feed.Mixed],
    sorts: [Type.Order.Chronological],
    filters: [],
  };
};
source.search = function (query, type, order, filters) {
  return new FeedPager({mode: "DefaultSearch", data: query, profile: null});
};
//Video
/**
 * 
 * @param {string} url
 * @returns 
 */
source.isContentDetailsUrl = function (url) {
  return url.startsWith("https://pmvhaven.com/video/");
};
source.getContentDetails = function (url) {
  return new HVideo(url);
};
/**
 * 
 * @param {any} data 
 * @param {string[]} path
 * @param {number} index 
 * @returns any
 */
function parseNUXT(data, path, index=0) {
  const curr=data[index];
  const target=path[0];
  log("Parsing with path "+JSON.stringify(path)+" and index "+index);
  if(curr[0]=='ShallowReactive'){
    log("ShallowReactive");
    return parseNUXT(data, path, curr[1]);
  }
  if(Array.isArray(curr)){
    if(curr.length==1){
      log("Tiny Array");
      return parseNUXT(data, path, curr[0]);
    }
    throw new ScriptException("Array has more than one element :" + curr.length);
  }
  if (typeof curr == "object"){
    if(path.length==0){
      log("Found object");
      return index;
    }
    for(const key of Object.keys(curr)){
      if(key==target){
        if(path.length==1){
          log("Found key "+key);
          return parseNUXT(data, [], curr[key]);
        }
        log("Found key "+key+" in path "+path);
        return parseNUXT(data, path.slice(1), curr[key]);
      }
    }
  }

  throw new ScriptException("Could not find key '"+target+"' in "+JSON.stringify(curr));
}

class HVideo extends PlatformVideoDetails {
  constructor(url) {
    let res = http.GET(url, {}, false);
    if (!res.isOk) {
      throw new ScriptException("Error trying to load '" + geturl + "'");
    }
    let dom = domParser.parseFromString(res.body);
    let data=dom.querySelector("script#__NUXT_DATA__").text;
    log("GOT DATA: "+data);
    const json = JSON.parse(data);
    const apiindex=parseNUXT(json, ["data", "/api/v2/videoInput"]);
    log("GOT APIINDEX: "+JSON.stringify(apiindex));
    const videoindex=parseNUXT(json, ["video"], apiindex);
    log("GOT VIDEOINDEX: "+JSON.stringify(videoindex));
    const videoobject=json[videoindex];
    log("GOT VIDEOOBJECT: "+JSON.stringify(videoobject));
    const title=json[videoobject.uploadTitle];
    log("GOT TITLE: "+title);
    const rawtitle=json[videoobject.title];
    const description=json[videoobject.description];
    log("GOT DESCRIPTION: "+description);
    const thumbnails=json[videoobject.thumbnails].map((a)=>json[a]);
    log("GOT THUMBNAILS: "+JSON.stringify(thumbnails));
    const vidurl=json[videoobject.url];
    log("GOT VIDURL: "+vidurl);
    const alturl=json[videoobject.videoUrl264];
    log("GOT ALTURL: "+alturl);
    const id=json[videoobject._id];
    log("GOT ID: "+id);
    // let vidurl=dom.querySelector("source").getAttribute("src");
    // let vidname=dom.querySelector(".align-center .pl-2").text;
    log(json.url);
    super({
      id: new PlatformID(PLATFORM, url, config.id),
      name: title,
      thumbnails: new Thumbnails(thumbnails.map((a)=>new Thumbnail(a, 720))),
      url: url,
      isLive: false,
      description: description,
      video: new VideoSourceDescriptor([
        (alturl!=null&&alturl!=undefined)?new VideoUrlSource({
          container: "video/mp4",
          name: "x264",
          codec: "H.264",
          url: alturl,
        }):null,
        new VideoUrlSource({
          container: "video/mp4",
          name: "mp4",
          url: vidurl,
        }),
      ].filter((a)=>a!=null)),
    });
    this.data= {
      id: id,
      title: rawtitle,
    };
  }

  getContentRecommendations() {
    let res2=http.POST("https://pmvhaven.com/api/v2/videoInput", JSON.stringify({
      mode: "getRecommended",
      profile: null,
      video: {
        _id: this.data.id,
        title: this.data.rawtitle,
      },
    }),{}, false);
    if (!res2.isOk) {
      throw new ScriptException("Error trying to load 'https://pmvhaven.com/api/v2/videoInput'");
    }
    const json2 = JSON.parse(res2.body);
    if (!json2.recommendedVideos){
      return;
    }
    this.recvids = json2.recommendedVideos.map((a)=>toVideo(a));
    return new ContentPager(this.recvids, false);
  }
}
source.getContentRecommendations = (url, initialData) => {
  throw new ScriptException("getContentRecommendations");
};

//Comments
source.getComments = function (url) {
  return new CommentPager(
    [
    ],
    false
  );
};
source.getSubComments = function (comment) {
  throw new ScriptException("This is a sample");
};

class FeedPager extends ContentPager {
  constructor(payload) {
    super([], true);
    this.payload = payload;
    this.page = 0;
    this.nextPage();
  }
  nextPage() {
    this.page++;
    const obj= {
      ...this.payload,
      index: this.page,
    }
    let res = undefined;
    res = http.POST("https://pmvhaven.com/api/v2/search", JSON.stringify(obj),{}, false);

    if (!res.isOk) {
      throw new ScriptException("Error trying to load '" + geturl + "'");
    }
    const json = JSON.parse(res.body);
    if (!json.data){
      this.hasMore = false;
      this.results = [];
      return this;
    }
    const out=json.data.map((a)=>toVideo(a));
    this.results = out;
    return this;
  }
}


function toVideo(a) {
  // const fakeurl=JSON.stringify({
  //   type: "pmvhaven",
  //   url: a.url,
  //   title: a.title,
  //   description: a.description,
  //   thumbnails: a.thumbnails.filter((b)=>b!="placeholder"),
  //   obj:a,
  // });
  const titleid=a.title.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
  const vidid=titleid+"_"+a._id;
  const vidurl="https://pmvhaven.com/video/"+vidid;
return new PlatformVideo({
  id: new PlatformID(
    "PMVHaven",
    vidurl,
    config.id
  ),
  name: a.title,
  thumbnails: new Thumbnails(a.thumbnails.filter((b)=>b!="placeholder").map((b)=>new Thumbnail(b, 720))),
  //   author: new PlatformAuthorLink(
  //     new PlatformID("SomePlatformName", "SomeAuthorID", config.id),
  //     "SomeAuthorName",
  //     "https://platform.com/your/channel/url",
  //     "../url/to/thumbnail.png"
  //   ),
  //   uploadDate: 1696880568,
  duration: a.duration,
  viewCount: a.views,
  url: vidurl,
  isLive: false,
});
}
log("LOADED");
