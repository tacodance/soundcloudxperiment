class AuthenticateController < ApplicationController
  
  def callback
    respond_to do |format|
      format.html { render :layout => false}
    end
  end
end
